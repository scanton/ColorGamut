import { NextRequest, NextResponse } from "next/server";
import { listProfiles, saveUploadedProfile } from "@/lib/profiles";

export async function GET() {
  const profiles = await listProfiles();
  return NextResponse.json({ profiles });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing ICC profile file" }, { status: 400 });
  }
  try {
    const savedPath = await saveUploadedProfile(file);
    const [meta] = await listProfiles().then((all) => all.filter((p) => p.path === savedPath));
    return NextResponse.json({ profile: meta });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
