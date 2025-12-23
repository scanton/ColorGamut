import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { AnalysisResult, AnalysisSettings, ProfileInfo } from "./types";

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function resolvePythonBinary() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".venv", "bin", "python"),
    path.join(cwd, ".venv", "Scripts", "python.exe"),
    "python3",
    "python"
  ];
  for (const candidate of candidates) {
    if (candidate.startsWith(cwd) && !(await pathExists(candidate))) {
      continue;
    }
    return candidate;
  }
  throw new Error("No python interpreter found. Install Python 3.10+ or create a venv.");
}

function buildArgs(imagePath: string, settings: AnalysisSettings, profile: ProfileInfo) {
  const args = [
    path.join(process.cwd(), "python", "analyze.py"),
    "--image",
    imagePath,
    "--output-profile",
    profile.path,
    "--rendering-intent",
    settings.renderingIntent,
    "--max-size",
    String(settings.maxSize),
    "--thresholds",
    settings.deltaEThresholds.join(","),
    "--rank-weights",
    `${settings.rankWeights?.p95 ?? 0.7},${settings.rankWeights?.mean ?? 0.3}`
  ];
  if (settings.inputProfilePath) {
    args.push("--input-profile", settings.inputProfilePath);
  }
  if (settings.blackPointCompensation) {
    args.push("--black-point-compensation");
  }
  if (settings.tacLimit !== undefined) {
    args.push("--tac-limit", String(settings.tacLimit));
  }
  return args;
}

export async function runPythonAnalysis(
  imagePath: string,
  settings: AnalysisSettings,
  profile: ProfileInfo
): Promise<AnalysisResult> {
  const pythonBin = await resolvePythonBinary();
  const args = buildArgs(imagePath, settings, profile);
  return new Promise<AnalysisResult>((resolve, reject) => {
    const child = spawn(pythonBin, args, { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    child.on("error", (err) => reject(err));
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python analyze exited with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as AnalysisResult;
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse analysis output: ${(err as Error).message}\n${stdout}\n${stderr}`));
      }
    });
  });
}
