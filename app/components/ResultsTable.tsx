"use client";

import { useMemo } from "react";
import { AnalysisResult } from "@/lib/types";

type Metric = "rank" | "p95" | "mean" | "max";

const labels: Record<Metric, string> = {
  rank: "Rank score",
  p95: "p95 ΔE",
  mean: "Mean ΔE",
  max: "Max ΔE",
};

export function ResultsTable({
  results,
  sortBy,
  onChangeSort,
}: {
  results: AnalysisResult[];
  sortBy: Metric;
  onChangeSort: (m: Metric) => void;
}) {
  const sorted = useMemo(() => {
    const clone = [...results];
    clone.sort((a, b) => metricValue(a, sortBy) - metricValue(b, sortBy));
    return clone;
  }, [results, sortBy]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <p className="text-sm font-semibold text-white">Profile comparison</p>
        <div className="flex items-center gap-2 text-xs text-slate-200">
          Sort by:
          {(Object.keys(labels) as Metric[]).map((metric) => (
            <button
              key={metric}
              onClick={() => onChangeSort(metric)}
              className={`rounded-lg px-2 py-1 ${
                sortBy === metric ? "bg-ink-accent text-slate-900" : "bg-slate-800 text-slate-200"
              }`}
            >
              {labels[metric]}
            </button>
          ))}
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-900/60 text-slate-300">
          <tr>
            <th className="px-3 py-2 text-left">Profile</th>
            <th className="px-3 py-2 text-left">Mean ΔE</th>
            <th className="px-3 py-2 text-left">p95 ΔE</th>
            <th className="px-3 py-2 text-left">Max ΔE</th>
            <th className="px-3 py-2 text-left">% ΔE>t2</th>
            <th className="px-3 py-2 text-left">Rank</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((res) => (
            <tr key={res.profile.path} className="border-t border-slate-800 text-slate-200">
              <td className="px-3 py-2">
                <p className="font-semibold text-white">{res.profile.name}</p>
                <p className="text-[11px] text-slate-400">{res.profile.description ?? res.profile.deviceClass}</p>
              </td>
              <Cell value={res.stats.mean_de} />
              <Cell value={res.stats.p95_de} />
              <Cell value={res.stats.max_de} />
              <Cell value={res.stats.pct_de_gt_t2} suffix="%" />
              <Cell value={res.stats.rank_score} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function metricValue(res: AnalysisResult, metric: Metric) {
  switch (metric) {
    case "p95":
      return res.stats.p95_de;
    case "mean":
      return res.stats.mean_de;
    case "max":
      return res.stats.max_de;
    default:
      return res.stats.rank_score;
  }
}

function Cell({ value, suffix }: { value: number; suffix?: string }) {
  return (
    <td className="px-3 py-2 text-slate-100">
      {value.toFixed(2)}
      {suffix}
    </td>
  );
}
