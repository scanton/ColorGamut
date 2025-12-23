import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ensureDir } from "./fs";

export async function saveFormFile(file: File, destDir: string, prefix = "") {
  await ensureDir(destDir);
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  const ext = path.extname(file.name) || "";
  const id = crypto.randomBytes(6).toString("hex");
  const filename = `${prefix}${id}${ext}`;
  const target = path.join(destDir, filename);
  await fs.writeFile(target, buf);
  return target;
}
