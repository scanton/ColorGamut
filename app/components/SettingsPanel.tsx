"use client";

import { AnalysisSettings, RenderingIntent } from "@/lib/types";

type Props = {
  settings: AnalysisSettings;
  onChange: (next: AnalysisSettings) => void;
};

const intents: { value: RenderingIntent; label: string }[] = [
  { value: "relative", label: "Relative Colorimetric" },
  { value: "perceptual", label: "Perceptual" },
  { value: "saturation", label: "Saturation" },
  { value: "absolute", label: "Absolute Colorimetric" }
];

export function SettingsPanel({ settings, onChange }: Props) {
  const update = (patch: Partial<AnalysisSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-100">Rendering</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label className="text-sm text-slate-200">
            Intent
            <select
              className="input mt-1"
              value={settings.renderingIntent}
              onChange={(e) => update({ renderingIntent: e.target.value as RenderingIntent })}
            >
              {intents.map((intent) => (
                <option key={intent.value} value={intent.value}>
                  {intent.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-200 flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-ink-accent"
              checked={settings.blackPointCompensation}
              onChange={(e) => update({ blackPointCompensation: e.target.checked })}
            />
            Black Point Compensation
          </label>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm text-slate-200">
          Max size (long edge, px)
          <input
            type="number"
            className="input mt-1"
            value={settings.maxSize}
            onChange={(e) => update({ maxSize: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm text-slate-200">
          ΔE threshold 1
          <input
            type="number"
            className="input mt-1"
            step="0.1"
            value={settings.deltaEThresholds[0]}
            onChange={(e) => update({ deltaEThresholds: [Number(e.target.value), settings.deltaEThresholds[1]] })}
          />
        </label>
        <label className="text-sm text-slate-200">
          ΔE threshold 2
          <input
            type="number"
            className="input mt-1"
            step="0.1"
            value={settings.deltaEThresholds[1]}
            onChange={(e) => update({ deltaEThresholds: [settings.deltaEThresholds[0], Number(e.target.value)] })}
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm text-slate-200">
          TAC limit (%)
          <input
            type="number"
            className="input mt-1"
            placeholder="e.g. 300"
            value={settings.tacLimit ?? ""}
            onChange={(e) => update({ tacLimit: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </label>
        <label className="text-sm text-slate-200">
          Rank weight (p95)
          <input
            type="number"
            className="input mt-1"
            step="0.05"
            value={settings.rankWeights?.p95 ?? 0.7}
            onChange={(e) =>
              update({ rankWeights: { p95: Number(e.target.value), mean: settings.rankWeights?.mean ?? 0.3 } })
            }
          />
        </label>
        <label className="text-sm text-slate-200">
          Rank weight (mean)
          <input
            type="number"
            className="input mt-1"
            step="0.05"
            value={settings.rankWeights?.mean ?? 0.3}
            onChange={(e) =>
              update({ rankWeights: { p95: settings.rankWeights?.p95 ?? 0.7, mean: Number(e.target.value) } })
            }
          />
        </label>
      </div>
    </div>
  );
}
