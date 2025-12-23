"use client";

import { useEffect, useState } from "react";
import { AnalysisResult, AnalysisSettings, ProfileInfo } from "@/lib/types";
import { ProfilePicker } from "@/app/components/ProfilePicker";
import { SettingsPanel } from "@/app/components/SettingsPanel";
import { AnalysisResultCard } from "@/app/components/AnalysisResultCard";
import { ErrorBanner } from "@/app/components/ErrorBanner";

const defaultSettings: AnalysisSettings = {
  renderingIntent: "relative",
  blackPointCompensation: true,
  maxSize: 1024,
  deltaEThresholds: [2, 5],
  outputProfilePath: "",
  rankWeights: { p95: 0.7, mean: 0.3 }
};

export default function SinglePage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [inputProfileFile, setInputProfileFile] = useState<File | null>(null);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [settings, setSettings] = useState<AnalysisSettings>(defaultSettings);
  const [result, setResult] = useState<AnalysisResult | null>(null);
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
    if (!imageFile) {
      setError("Upload an image first.");
      return;
    }
    if (!selectedProfiles.length) {
      setError("Pick at least one output profile.");
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const form = new FormData();
      form.append("mode", "single");
      form.append("image", imageFile);
      form.append("profiles", JSON.stringify(selectedProfiles.slice(0, 1)));
      form.append("settings", JSON.stringify(settings));
      if (inputProfileFile) {
        form.append("inputProfile", inputProfileFile);
      }
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data.result as AnalysisResult);
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadSample = async () => {
    const res = await fetch("/samples/sample.png");
    const blob = await res.blob();
    const file = new File([blob], "sample.png", { type: blob.type });
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  return (
    <main className="grid gap-6">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Single image analysis</h1>
            <p className="text-slate-300 text-sm">
              Upload one RGB image, choose an output ICC, and review ΔE2000 + TAC summaries with previews.
            </p>
          </div>
          <button className="btn" onClick={loadSample} type="button">
            Try sample
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn cursor-pointer bg-ink-warm text-slate-950 hover:bg-orange-300">
            Upload image
            <input
              type="file"
              accept="image/png,image/jpeg,image/tiff"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setImageFile(file ?? null);
                setImagePreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          {imageFile && <p className="text-sm text-slate-200">Loaded: {imageFile.name}</p>}
        </div>
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
          {loading ? "Analyzing…" : "Run analysis"}
        </button>
        <p className="text-xs text-slate-400">
          Input profile defaults to sRGB. Upload ICCs via the picker above. Max size controls downsampling speed.
        </p>
      </div>
      {result && <AnalysisResultCard result={result} sourcePreview={imagePreview ?? undefined} />}
    </main>
  );
}
