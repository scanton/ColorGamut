import argparse
import base64
import json
import os
import sys
from io import BytesIO

import numpy as np
from PIL import Image

try:
    import pyvips  # type: ignore
except ImportError as exc:  # pragma: no cover - dependency notice
    sys.stderr.write(
        "pyvips is required for ICC transforms. Install system libvips and run pip install -r python/requirements.txt\n"
    )
    raise

try:
    import colour  # type: ignore
except ImportError as exc:  # pragma: no cover
    sys.stderr.write("colour-science is required for ΔE calculation. Run pip install -r python/requirements.txt\n")
    raise


INTENT_MAP = {
    # pyvips/VIPS intent enums
    "relative": "relative",
    "perceptual": "perceptual",
    "saturation": "saturation",
    "absolute": "absolute",
}

DTYPE_MAP = {
    "uchar": np.uint8,
    "char": np.int8,
    "ushort": np.uint16,
    "short": np.int16,
    "uint": np.uint32,
    "int": np.int32,
    "float": np.float32,
    "double": np.float64,
}


def load_image(path: str) -> "pyvips.Image":
    """
    Load an image using Pillow and create a pyvips image from raw RGB bytes.
    This avoids libvips PNG decoder issues on malformed files.
    """
    with Image.open(path) as pil:
        pil = pil.convert("RGB")
        arr = np.array(pil, dtype=np.uint8)
        return pyvips.Image.new_from_memory(arr.tobytes(), pil.width, pil.height, 3, format="uchar")


def to_numpy(image: "pyvips.Image") -> np.ndarray:
    dtype = DTYPE_MAP.get(image.format)
    if dtype is None:
        raise ValueError(f"Unsupported pixel format {image.format}")
    memory = image.write_to_memory()
    arr = np.ndarray(buffer=memory, dtype=dtype, shape=[image.height, image.width, image.bands])
    return arr


def resize_image(image: "pyvips.Image", max_size: int) -> "pyvips.Image":
    if max_size <= 0:
        return image
    long_edge = max(image.width, image.height)
    if long_edge <= max_size:
        return image
    scale = max_size / float(long_edge)
    return image.resize(scale)


def icc_to_lab(
    image: "pyvips.Image", input_profile: str, intent: str, black_point: bool
) -> "pyvips.Image":
    # Convert to sRGB using the supplied input profile, then to Lab via colourspace
    srgb = image.icc_transform(
        "srgb", input_profile=input_profile, intent=intent, black_point_compensation=black_point
    )
    lab = srgb.colourspace("lab")
    return lab.cast("float")


def proof_and_lab(
    image: "pyvips.Image", input_profile: str, output_profile: str, intent: str, black_point: bool
) -> tuple["pyvips.Image", "pyvips.Image"]:
    proof = image.icc_transform(
        output_profile, input_profile=input_profile, intent=intent, black_point_compensation=black_point
    )
    proof_srgb = proof.icc_transform(
        "srgb", input_profile=output_profile, intent=intent, black_point_compensation=black_point
    )
    proof_lab = proof_srgb.colourspace("lab").cast("float")
    return proof, proof_lab


def delta_e_stats(original_lab: np.ndarray, proof_lab: np.ndarray, thresholds: tuple[float, float]):
    delta = colour.delta_E(original_lab, proof_lab, method="CIE 2000")
    flat = delta.reshape(-1)
    t1, t2 = thresholds
    mean_de = float(np.mean(flat))
    p95_de = float(np.percentile(flat, 95))
    max_de = float(np.max(flat))
    pct_t1 = float(np.mean(flat > t1) * 100.0)
    pct_t2 = float(np.mean(flat > t2) * 100.0)
    return delta, {
        "mean_de": mean_de,
        "p95_de": p95_de,
        "max_de": max_de,
        "pct_de_gt_t1": pct_t1,
        "pct_de_gt_t2": pct_t2,
    }


def encode_png(image_arr: np.ndarray) -> str:
    if image_arr.dtype != np.uint8:
        image_arr = np.clip(image_arr, 0, 255).astype(np.uint8)
    pil = Image.fromarray(image_arr, mode="L")
    buf = BytesIO()
    pil.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def make_heatmap(delta: np.ndarray) -> str:
    max_val = float(np.percentile(delta, 99.5))
    if max_val <= 0:
        max_val = 1.0
    scaled = np.clip(delta * (255.0 / max_val), 0, 255).astype(np.uint8)
    return encode_png(scaled)


def make_mask(delta: np.ndarray, threshold: float) -> str:
    mask = (delta > threshold).astype(np.uint8) * 255
    return encode_png(mask)


def tac_metrics(device_space: np.ndarray, limit: float | None):
    max_val = float(device_space.max()) if device_space.size else 0.0
    norm = 100.0
    if max_val <= 1.5:
        norm = 1.0
    elif max_val > 150.0:
        norm = 255.0
    tac_pct = device_space.sum(axis=2) / norm * 100.0
    stats = {
        "supported": True,
        "limit": limit,
        "p95": float(np.percentile(tac_pct, 95)),
        "max": float(np.max(tac_pct)),
    }
    if limit is not None:
        stats["pct_gt_limit"] = float(np.mean(tac_pct > limit) * 100.0)
    return stats


def analyze(
    image_path: str,
    input_profile: str,
    output_profile: str,
    intent_label: str,
    intent_value: str,
    black_point: bool,
    max_size: int,
    thresholds: tuple[float, float],
    tac_limit: float | None,
    rank_weights: tuple[float, float],
):
    image = load_image(image_path)
    image = resize_image(image, max_size)

    original_lab = icc_to_lab(image, input_profile, intent_value, black_point)
    proof_device, proof_lab = proof_and_lab(image, input_profile, output_profile, intent_value, black_point)

    orig_np = to_numpy(original_lab).astype(np.float32)
    proof_np = to_numpy(proof_lab).astype(np.float32)
    delta, stats = delta_e_stats(orig_np, proof_np, thresholds)

    previews = {
        "de_heatmap_png_base64": make_heatmap(delta),
        "mask_png_base64": make_mask(delta, thresholds[1]),
    }

    tac = {"supported": False}
    try:
        device_np = to_numpy(proof_device).astype(np.float32)
        tac = tac_metrics(device_np, tac_limit)
    except Exception:
        tac = {"supported": False}

    rank_score = rank_weights[0] * stats["p95_de"] + rank_weights[1] * stats["mean_de"]
    stats["rank_score"] = rank_score

    return {
        "profile": {
            "name": os.path.basename(output_profile),
            "path": output_profile,
            "channels": proof_device.bands,
        },
        "settings": {
            "inputProfilePath": input_profile,
            "outputProfilePath": output_profile,
            "renderingIntent": intent_label,
            "blackPointCompensation": black_point,
            "maxSize": max_size,
            "deltaEThresholds": list(thresholds),
            "tacLimit": tac_limit,
            "rankWeights": {"p95": rank_weights[0], "mean": rank_weights[1]},
        },
        "stats": stats,
        "tac": tac,
        "previews": previews,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Analyze image against ICC output profile.")
    parser.add_argument("--image", required=True, help="Path to input RGB image")
    parser.add_argument("--input-profile", default="srgb", help="Input ICC profile path (default sRGB)")
    parser.add_argument("--output-profile", required=True, help="Output printer ICC profile path")
    parser.add_argument("--rendering-intent", default="relative", choices=list(INTENT_MAP.keys()))
    parser.add_argument("--black-point-compensation", action="store_true", default=False)
    parser.add_argument("--max-size", type=int, default=1024, help="Max long-edge pixels for analysis")
    parser.add_argument("--thresholds", default="2,5", help="ΔE thresholds, comma-separated")
    parser.add_argument("--tac-limit", type=float, default=None, help="Optional TAC limit percentage")
    parser.add_argument("--rank-weights", default="0.7,0.3", help="Weights for p95 and mean in rank score")
    return parser.parse_args()


def main():
    args = parse_args()
    thresholds = tuple(float(x) for x in args.thresholds.split(","))  # type: ignore
    rank_weights = tuple(float(x) for x in args.rank_weights.split(","))  # type: ignore
    intent_value = INTENT_MAP.get(args.rendering_intent, "relative")
    try:
        result = analyze(
            image_path=args.image,
            input_profile=args.input_profile,
            output_profile=args.output_profile,
            intent_label=args.rendering_intent,
            intent_value=intent_value,
            black_point=args.black_point_compensation,
            max_size=args.max_size,
            thresholds=(thresholds[0], thresholds[1]),
            tac_limit=args.tac_limit,
            rank_weights=(rank_weights[0], rank_weights[1]),
        )
        json.dump(result, sys.stdout)
    except pyvips.Error as err:
        sys.stderr.write(f"pyvips error: {err}\n")
        sys.exit(1)
    except Exception as exc:
        sys.stderr.write(f"Analysis failed: {exc}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
