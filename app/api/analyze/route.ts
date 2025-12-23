import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { runPythonAnalysis } from "@/lib/pythonRunner";
import { ensureDir, resolveTempPath } from "@/lib/fs";
import { listProfiles } from "@/lib/profiles";
import { saveFormFile } from "@/lib/uploads";
import { AnalysisResult, AnalysisSettings, ProfileInfo } from "@/lib/types";

function parseJson<T>(value: FormDataEntryValue | null, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function cleanup(paths: string[]) {
  await Promise.all(
    paths.map(async (p) => {
      try {
        await fs.rm(p, { force: true });
      } catch {
        // ignore
      }
    })
  );
}

function normalizeSettings(settings: Partial<AnalysisSettings>): AnalysisSettings {
  return {
    inputProfilePath: settings.inputProfilePath,
    outputProfilePath: settings.outputProfilePath ?? "",
    renderingIntent: settings.renderingIntent ?? "relative",
    blackPointCompensation: settings.blackPointCompensation ?? true,
    maxSize: settings.maxSize ?? 1024,
    deltaEThresholds: (settings.deltaEThresholds as [number, number]) ?? [2, 5],
    tacLimit: settings.tacLimit,
    rankWeights: settings.rankWeights ?? { p95: 0.7, mean: 0.3 }
  };
}

function findProfiles(selected: string[], available: ProfileInfo[]) {
  const set = new Set(selected);
  return available.filter((p) => set.has(p.path) || set.has(p.name));
}

async function runForProfiles(
  imagePath: string,
  baseSettings: AnalysisSettings,
  profiles: ProfileInfo[]
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];
  for (const profile of profiles) {
    const settings = { ...baseSettings, outputProfilePath: profile.path };
    const result = await runPythonAnalysis(imagePath, settings, profile);
    results.push(result);
  }
  return results;
}

async function handleSingleOrCompare(
  form: FormData,
  mode: "single" | "compare",
  settings: AnalysisSettings,
  profiles: ProfileInfo[]
) {
  const imageFile = form.get("image");
  if (!imageFile || !(imageFile instanceof File)) {
    return NextResponse.json({ error: "Missing image file" }, { status: 400 });
  }
  const tempDir = resolveTempPath("uploads");
  await ensureDir(tempDir);
  const tempPath = await saveFormFile(imageFile, tempDir, "img-");
  try {
    const results = await runForProfiles(tempPath, settings, profiles);
    if (mode === "single") {
      return NextResponse.json({ result: results[0] });
    }
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  } finally {
    await cleanup([tempPath]);
  }
}

async function handleBatch(form: FormData, settings: AnalysisSettings, profiles: ProfileInfo[]) {
  const files = form.getAll("images").filter((f) => f instanceof File) as File[];
  if (!files.length) {
    return NextResponse.json({ error: "No images uploaded" }, { status: 400 });
  }
  const tempDir = resolveTempPath("uploads");
  await ensureDir(tempDir);
  const results: { file: string; result?: AnalysisResult; error?: string }[] = [];
  const paths: string[] = [];
  for (const file of files) {
    const saved = await saveFormFile(file, tempDir, "batch-");
    paths.push(saved);
    try {
      const [result] = await runForProfiles(saved, settings, profiles);
      results.push({ file: file.name, result });
    } catch (error) {
      results.push({ file: file.name, error: (error as Error).message });
    }
  }
  await cleanup(paths);
  return NextResponse.json({ results });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const mode = (form.get("mode") as string) || "single";
  const settings = normalizeSettings(parseJson(form.get("settings"), {}));
  const selectedProfiles = parseJson<string[]>(form.get("profiles"), []);
  const available = await listProfiles();
  const profiles = findProfiles(selectedProfiles, available);
  if (!profiles.length) {
    return NextResponse.json({ error: "No output profiles selected or found" }, { status: 400 });
  }
  const cleanupPaths: string[] = [];
  const inputProfileFile = form.get("inputProfile");
  if (inputProfileFile instanceof File) {
    const saved = await saveFormFile(inputProfileFile, resolveTempPath("profiles"), "input-");
    settings.inputProfilePath = saved;
    cleanupPaths.push(saved);
  }
  try {
    if (mode === "batch") {
      return await handleBatch(form, settings, profiles.slice(0, 1));
    }
    if (mode === "compare") {
      return await handleSingleOrCompare(form, "compare", settings, profiles);
    }
    return await handleSingleOrCompare(form, "single", settings, profiles.slice(0, 1));
  } finally {
    await cleanup(cleanupPaths);
  }
}
