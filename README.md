# ColorGamut

Local Next.js app for soft-proofing RGB images against printer ICC output profiles. It runs a Python/pyvips analysis to compute ΔE2000, TAC, and previews, then surfaces results in a UI for single images, multi-profile comparison, and batch ranking.

## Prerequisites
- Node.js 20+ and pnpm
- Python 3.10+ (3.11 recommended)
- System libvips (required by pyvips)
  - macOS: `brew install vips`
  - Linux: `apt-get install libvips` (or distro equivalent)
  - Windows: install a vips binary (e.g., https://github.com/libvips/libvips/releases) and ensure it is on `PATH`

## Setup
```bash
pnpm install
```

Python env (recommended):
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r python/requirements.txt
```

Run the dev server:
```bash
pnpm dev
```
Open http://localhost:3000.

If pyvips is missing, API responses will include a setup hint; install libvips + pip deps and retry.

## App structure
- `app/` Next.js App Router pages: `/single`, `/compare`, `/batch`
- `app/api/analyze` calls `python/analyze.py` via child_process
- `app/api/profiles` lists or uploads ICC profiles
- `profiles/` built-in profiles (drop your .icc/.icm here)
- `profiles/user/` user uploads (ignored by git)
- `.tmp/` transient uploads used during analysis
- `python/analyze.py` performs ICC transforms, ΔE2000 stats, TAC, and preview PNGs

## Usage
1) Add printer profiles: place `.icc`/`.icm` files in `profiles/` or upload in the UI (they land in `profiles/user/`). Extended ink sets (CMYK+OGV, OG, etc.) are just ICCs—drop them in and select them.
2) (Optional) Upload an input RGB ICC profile; sRGB is the default.
3) Pick rendering intent, BPC, analysis size, thresholds, and TAC limit (if desired).
4) Upload images and run:
   - `/single` one image, one output profile + heatmap/mask previews.
   - `/compare` one image vs multiple profiles with sortable table and preview for the top rank.
   - `/batch` many images vs one profile, ranked by 0.7×p95 + 0.3×mean (editable weights).

## Interpreting results
- **Mean ΔE2000**: Average perceptual shift. Rough guide: ≤1 great, 1–3 low, 3–5 watch, >5 noticeable.
- **p95 ΔE2000**: 95th percentile; use as the main “risk” gauge. ≤2 great, 2–4 low, 4–6 medium, >6 high.
- **Max ΔE2000**: Worst pixel. Spikes can be okay; focus on p95/mean. >6 is a strong warning.
- **% ΔE > t1 / t2**: How much of the image exceeds your thresholds (defaults 2 and 5). A few percent is usually fine; double digits mean visible shifts over larger areas.
- **Rank score**: Default 0.7×p95 + 0.3×mean. Lower is better; use it to sort profiles/images quickly.
- **TAC (Total Area Coverage)**: Sum of device-space channels as %. If TAC is supported for the profile:
  - p95 TAC / Max TAC: Check against your press limit (e.g., 300%+ is often too high for CMYK).
  - % TAC > limit: Portion over your configured limit. Aim for near 0%.
- **Visual cues**: Metric tiles are color-coded green → yellow → red based on the above ranges to highlight risk at a glance.
- **Previews**:
  - ΔE heatmap: Brighter means larger ΔE; use to spot trouble areas.
  - Mask: White where ΔE exceeds the higher threshold.
  - Source preview: Handy for correlating issues to the original image.

### API shape
- `POST /api/analyze` (multipart)
  - `mode`: `single` | `compare` | `batch`
  - `image` or `images[]`: RGB input(s)
  - `profiles`: JSON array of profile paths/names
  - `inputProfile` (file, optional): input ICC; defaults to sRGB
  - `settings`: JSON with `renderingIntent`, `blackPointCompensation`, `maxSize`, `deltaEThresholds`, `tacLimit`, `rankWeights`
  - Response: analysis result(s) with stats, TAC info, and base64 previews
- `GET /api/profiles`: list profiles found in `profiles/` and `profiles/user/`
- `POST /api/profiles`: upload an ICC file into `profiles/user/`

## Notes
- Sample image: `public/samples/sample.png` (small RGB gradient).
- TAC is computed as sum of device-space channels, normalized heuristically (0–100%); if unsupported, `tac.supported` is false.
- Temporary files live in `.tmp/` and are cleaned after each request.

## Troubleshooting
- pyvips/libvips missing: install system vips and reinstall Python deps.
- Permission issues writing `.tmp/`: ensure the repo path is writable and `.tmp/` exists.
- Windows: ensure the vips bin directory is on `PATH`; run analysis from a shell that can find `python.exe` in `.venv` or system Python.
