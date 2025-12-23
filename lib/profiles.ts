import fs from "fs/promises";
import path from "path";
import { ProfileInfo } from "./types";

const PROFILE_EXTS = [".icc", ".icm"];

function looksLikeProfile(file: string) {
  return PROFILE_EXTS.includes(path.extname(file).toLowerCase());
}

function mapChannels(colorSpace?: string) {
  if (!colorSpace) return undefined;
  const key = colorSpace.toUpperCase();
  const map: Record<string, number> = {
    RGB: 3,
    GRAY: 1,
    CMYK: 4,
    CMY: 3,
    LAB: 3
  };
  if (map[key]) return map[key];
  return undefined;
}

async function parseDescription(buf: Buffer, offset: number, size: number) {
  if (offset + 12 > buf.length) return undefined;
  const typeSig = buf.toString("ascii", offset, offset + 4);
  if (typeSig !== "desc") return undefined;
  const length = buf.readUInt32BE(offset + 8);
  if (length <= 0 || offset + 12 + length > buf.length) return undefined;
  return buf.toString("ascii", offset + 12, offset + 12 + length - 1).trim();
}

async function readProfileMetadata(filePath: string): Promise<ProfileInfo> {
  const buf = await fs.readFile(filePath);
  const deviceClass = buf.toString("ascii", 12, 16).trim();
  const colorSpace = buf.toString("ascii", 16, 20).trim();
  let description: string | undefined;
  try {
    const tagCount = buf.readUInt32BE(128);
    for (let i = 0; i < tagCount; i++) {
      const entryOffset = 132 + i * 12;
      const sig = buf.toString("ascii", entryOffset, entryOffset + 4);
      if (sig === "desc") {
        const offset = buf.readUInt32BE(entryOffset + 4);
        const size = buf.readUInt32BE(entryOffset + 8);
        description = await parseDescription(buf, offset, size);
        break;
      }
    }
  } catch {
    description = undefined;
  }
  return {
    name: path.basename(filePath),
    path: filePath,
    description,
    deviceClass,
    colorSpace,
    channels: mapChannels(colorSpace)
  };
}

export async function listProfiles(): Promise<ProfileInfo[]> {
  const base = path.join(process.cwd(), "profiles");
  const user = path.join(base, "user");
  const files: ProfileInfo[] = [];

  const walk = async (dir: string, userProvided = false) => {
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (!looksLikeProfile(entry)) continue;
        const full = path.join(dir, entry);
        const meta = await readProfileMetadata(full);
        meta.userProvided = userProvided;
        files.push(meta);
      }
    } catch {
      // ignore missing directory
    }
  };

  await walk(base, false);
  await walk(user, true);
  return files;
}

export async function saveUploadedProfile(file: File, destName?: string) {
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  const dir = path.join(process.cwd(), "profiles", "user");
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, destName ?? file.name);
  await fs.writeFile(target, buf);
  return target;
}
