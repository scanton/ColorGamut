"use client";

import { useMemo } from "react";
import { AnalysisResult } from "@/lib/types";

const fmt = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? "—" : v.toFixed(2));

type MetricKey =
  | "mean_de"
  | "p95_de"
  | "max_de"
  | "pct_de_gt_t1"
  | "pct_de_gt_t2"
  | "rank_score"
  | "tac_p95"
  | "tac_max"
  | "tac_pct";

const metricThresholds: Record<MetricKey, number[]> = {
  mean_de: [1, 3, 5],
  p95_de: [2, 4, 6],
  max_de: [3, 6, 10],
  pct_de_gt_t1: [5, 15, 30],
  pct_de_gt_t2: [2, 8, 15],
  rank_score: [2, 4, 6],
  tac_p95: [240, 280, 320],
  tac_max: [260, 300, 340],
  tac_pct: [5, 15, 30]
};

type SeverityStyle = { background: string; border: string; text: string };

function severityColor(metric: MetricKey, value: number | undefined): SeverityStyle {
  if (value === undefined || Number.isNaN(value)) {
    return { background: "linear-gradient(135deg, rgba(15,23,42,0.8), rgba(30,41,59,0.8))", border: "#1e293b", text: "#e2e8f0" };
  }
  const stops = metricThresholds[metric];
  const [g, y, r] = [stops[0], stops[1], stops[2]];
  let t = 0;
  if (value <= g) t = 0;
  else if (value <= y) t = (value - g) / (y - g);
  else if (value <= r) t = (value - y) / (r - y) + 1;
  else t = 2;
  // map t in [0,2] -> green -> yellow -> red
  const hue = t <= 1 ? 140 - 70 * t : 60 - 60 * (t - 1);
  const background = `linear-gradient(135deg, hsla(${hue},65%,22%,0.95), hsla(${hue},65%,14%,0.92))`;
  const border = `hsla(${hue},70%,38%,0.9)`;
  const text = "#f8fafc";
  return { background, border, text };
}

export function AnalysisResultCard({ result, sourcePreview }: { result: AnalysisResult; sourcePreview?: string }) {
  const stats = result.stats;
  const tac = result.tac;
  return (
    <div className="card grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <p className="text-lg font-semibold text-white">{result.profile.name}</p>
        <div className="grid grid-cols-2 gap-2 text-sm text-slate-200">
          <Metric label="Mean ΔE2000" value={fmt(stats.mean_de)} severity="mean_de" raw={stats.mean_de} />
          <Metric label="p95 ΔE2000" value={fmt(stats.p95_de)} severity="p95_de" raw={stats.p95_de} />
          <Metric label="Max ΔE2000" value={fmt(stats.max_de)} severity="max_de" raw={stats.max_de} />
          <Metric
            label="% ΔE > t1"
            value={fmt(stats.pct_de_gt_t1)}
            suffix="%"
            severity="pct_de_gt_t1"
            raw={stats.pct_de_gt_t1}
          />
          <Metric
            label="% ΔE > t2"
            value={fmt(stats.pct_de_gt_t2)}
            suffix="%"
            severity="pct_de_gt_t2"
            raw={stats.pct_de_gt_t2}
          />
          <Metric label="Rank score" value={fmt(stats.rank_score)} severity="rank_score" raw={stats.rank_score} />
        </div>
        {tac.supported ? (
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-200">
            <Metric label="TAC p95" value={fmt(tac.p95)} severity="tac_p95" raw={tac.p95} />
            <Metric label="TAC max" value={fmt(tac.max)} severity="tac_max" raw={tac.max} />
            <Metric label="% TAC > limit" value={fmt(tac.pct_gt_limit)} suffix="%" severity="tac_pct" raw={tac.pct_gt_limit} />
          </div>
        ) : (
          <p className="text-xs text-slate-400">TAC not available for this profile.</p>
        )}
        <p className="text-xs text-slate-400">
          Intent: {result.settings.renderingIntent} · BPC: {result.settings.blackPointCompensation ? "on" : "off"} ·
          Max size: {result.settings.maxSize}px
        </p>
        {sourcePreview && <Preview title="Source image (preview)" src={sourcePreview} />}
      </div>
      <div className="grid gap-3">
        {result.previews.de_heatmap_png_base64 && (
          <Preview title="ΔE heatmap" base64={result.previews.de_heatmap_png_base64} />
        )}
        {result.previews.mask_png_base64 && (
          <Preview title="ΔE > threshold mask" base64={result.previews.mask_png_base64} />
        )}
      </div>
      <p className="text-[11px] text-slate-300">
        Color cues: green ≈ in-gamut, yellow ≈ watch, red ≈ high risk (roughly p95 ΔE &gt; 4 or max ΔE &gt; 6).
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  severity,
  raw
}: {
  label: string;
  value: string;
  suffix?: string;
  severity: MetricKey;
  raw?: number;
}) {
  const colors = useMemo(() => severityColor(severity, raw), [severity, raw]);
  return (
    <div
      className="rounded-xl border p-3 shadow-sm shadow-slate-900/40"
      style={{ background: colors.background, borderColor: colors.border, color: colors.text }}
    >
      <p className="text-[11px] uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-lg font-semibold">
        {value}
        {suffix}
      </p>
    </div>
  );
}

function Preview({ title, base64, src }: { title: string; base64?: string; src?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <p className="text-xs font-semibold text-slate-200">{title}</p>
      <img
        src={base64 ? `data:image/png;base64,${base64}` : src}
        alt={title}
        className="mt-2 w-full rounded-lg border border-slate-700"
      />
    </div>
  );
}
