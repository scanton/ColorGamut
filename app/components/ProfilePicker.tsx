"use client";

import { useEffect, useState } from "react";
import { ProfileInfo } from "@/lib/types";

type Props = {
  label?: string;
  selected: string[];
  onChange: (paths: string[]) => void;
  multi?: boolean;
  allowUpload?: boolean;
};

export function ProfilePicker({ label, selected, onChange, multi = true, allowUpload = true }: Props) {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const load = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/profiles", { cache: "no-store" });
      const data = await res.json();
      setProfiles(data.profiles ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (path: string) => {
    if (multi) {
      const set = new Set(selected);
      if (set.has(path)) set.delete(path);
      else set.add(path);
      onChange(Array.from(set));
    } else {
      onChange([path]);
    }
  };

  const handleUpload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/profiles", { method: "POST", body: form });
    const data = await res.json();
    await load();
    if (data?.profile?.path) {
      const newPath = data.profile.path as string;
      if (multi) {
        onChange([...new Set([...selected, newPath])]);
      } else {
        onChange([newPath]);
      }
    }
  };

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-100">{label ?? "Printer profiles"}</p>
          <p className="text-xs text-slate-400">Profiles read from profiles/ and profiles/user/</p>
        </div>
        {allowUpload && (
          <label className="btn cursor-pointer">
            Upload ICC
            <input
              type="file"
              accept=".icc,.icm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          </label>
        )}
      </div>
      {loading && <p className="text-xs text-slate-400">Loading profiles…</p>}
      {error && <p className="text-xs text-rose-300">Error: {error}</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {profiles.map((p) => {
          const active = selected.includes(p.path);
          return (
            <button
              key={p.path}
              type="button"
              className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                active ? "border-ink-accent bg-ink-accent/20" : "border-slate-700 bg-slate-900/40"
              }`}
              onClick={() => toggle(p.path)}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.description || p.deviceClass || "ICC profile"}</p>
                </div>
                <span className="text-[11px] font-semibold text-ink-accent">
                  {p.colorSpace ?? "?"} · {p.channels ?? "?"}ch
                </span>
              </div>
              {p.userProvided && <p className="text-[10px] text-ink-warm">User upload</p>}
            </button>
          );
        })}
        {!profiles.length && !loading && <p className="text-xs text-slate-400">No profiles found yet.</p>}
      </div>
    </div>
  );
}
