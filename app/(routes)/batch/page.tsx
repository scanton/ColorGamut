"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisResult, AnalysisSettings, ProfileInfo } from "@/lib/types";
import { ProfilePicker } from "@/app/components/ProfilePicker";
import { SettingsPanel } from "@/app/components/SettingsPanel";
import { ErrorBanner } from "@/app/components/ErrorBanner";

const defaultSettings: AnalysisSettings = {
  renderingIntent: "relative",
  blackPointCompensation: true,
  maxSize: 512,
  deltaEThresholds: [2, 5],
  outputProfilePath: "",
  rankWeights: { p95: 0.7, mean: 0.3 }
};

type BatchEntry = { file: string; result?: AnalysisResult; error?: string };

export default function BatchPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [inputProfileFile, setInputProfileFile] = useState<File | null>(null);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [settings, setSettings] = useState<AnalysisSettings>(defaultSettings);
  const [results, setResults] = useState<BatchEntry[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<ProfileInfo[]>([]);

  useEffect(() => {
    if (selectedProfiles.length) {
      setSettings((prev) => ({ ...prev, outputProfilePath: selectedProfiles[0] }));
    }
  }, [selectedProfiles]);

  useEffect(() => {
    fetch("/api/profiles")
      .then((res) => res.json())
      .then((data) => setAvailableProfiles(data.profiles ?? []))
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (!files.length) {
      setError("Upload at least one image.");
      return;
    }
    if (!selectedProfiles.length) {
      setError("Pick an output profile.");
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const form = new FormData();
      form.append("mode", "batch");
      form.append("profiles", JSON.stringify(selectedProfiles.slice(0, 1)));
      form.append("settings", JSON.stringify(settings));
      if (inputProfileFile) {
        form.append("inputProfile", inputProfileFile);
      }
      files.forEach((f) => form.append("images", f));
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResults(data.results as BatchEntry[]);
    } catch (err) {
      setResults([]);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sorted = useMemo(() => {
    const success = results.filter((r) => r.result);
    return success.sort((a, b) => (a.result!.stats.rank_score ?? 0) - (b.result!.stats.rank_score ?? 0));
  }, [results]);

  const loadSample = async () => {
    const res = await fetch("/samples/sample.png");
    const blob = await res.blob();
    setFiles([new File([blob], "sample.png", { type: blob.type })]);
  };

  return (
    <main className="grid gap-6">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Batch ranking</h1>
            <p className="text-slate-300 text-sm">
              Upload many images, choose one printer ICC, and rank the worst offenders by ΔE2000.
            </p>
          </div>
          <button className="btn" onClick={loadSample} type="button">
            Try sample
          </button>
        </div>
        <label className="btn cursor-pointer bg-ink-warm text-slate-950 hover:bg-orange-300">
          Upload images
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/tiff"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        {files.length > 0 && <p className="text-sm text-slate-200">{files.length} images queued.</p>}
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
          <label className="btn cursor-pointer">
            Input ICC (optional)
            <input
              type="file"
              accept=".icc,.icm"
              className="hidden"
              onChange={(e) => setInputProfileFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {inputProfileFile ? (
            <span>Input profile: {inputProfileFile.name}</span>
          ) : (
            <span className="text-slate-400">Defaults to sRGB if omitted.</span>
          )}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-sm text-slate-200">
            Select existing ICC as input
            <select
              className="input mt-1"
              value={settings.inputProfilePath ?? ""}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  inputProfilePath: e.target.value || undefined
                }))
              }
            >
              <option value="">sRGB (default)</option>
              {availableProfiles.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ErrorBanner message={error} />
      </div>
      <ProfilePicker selected={selectedProfiles} onChange={setSelectedProfiles} multi={false} />
      <SettingsPanel settings={settings} onChange={setSettings} />
      <div className="flex gap-3">
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? "Analyzing…" : "Rank images"}
        </button>
        <p className="text-xs text-slate-400">We run one profile per request; results sort by rank score.</p>
      </div>
      {sorted.length > 0 && (
        <div className="card">
          <p className="mb-3 text-sm font-semibold text-white">Ranked results</p>
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Image</th>
                <th className="px-3 py-2 text-left">Mean ΔE</th>
                <th className="px-3 py-2 text-left">p95 ΔE</th>
                <th className="px-3 py-2 text-left">Rank score</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.file} className="border-t border-slate-800 text-slate-200">
                  <td className="px-3 py-2">{row.file}</td>
                  <td className="px-3 py-2">{row.result?.stats.mean_de.toFixed(2)}</td>
                  <td className="px-3 py-2">{row.result?.stats.p95_de.toFixed(2)}</td>
                  <td className="px-3 py-2">{row.result?.stats.rank_score.toFixed(2)}</td>
                </tr>
              ))}
              {results
                .filter((r) => r.error)
                .map((row) => (
                  <tr key={`${row.file}-err`} className="border-t border-slate-800 text-rose-200">
                    <td className="px-3 py-2">{row.file}</td>
                    <td className="px-3 py-2" colSpan={3}>
                      {row.error}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
