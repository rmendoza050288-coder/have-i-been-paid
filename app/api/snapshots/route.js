import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

// Same app-data directory convention as app/api/autosave/route.js.
function getAppDataDir() {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Have I Been Paid");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Have I Been Paid");
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "Have I Been Paid");
}

const SNAPSHOT_DIR = path.join(getAppDataDir(), "snapshots");
const MAX_SNAPSHOTS = 30;
const MAX_BYTES = 25 * 1024 * 1024;
const ID_PATTERN = /^[\w.-]+\.json$/;

function listFiles() {
  if (!fs.existsSync(SNAPSHOT_DIR)) return [];
  return fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => ID_PATTERN.test(f))
    .sort()
    .reverse();
}

// Filenames look like: 2026-01-31T12-00-00-000Z_manual.json
function parseName(id) {
  const m = id.match(/^(.+?)_(manual|auto)\.json$/);
  if (!m) return null;
  const createdAt = m[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
  return { createdAt, reason: m[2] };
}

// GET /api/snapshots — list snapshots, or ?id=... to fetch one.
export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    if (!ID_PATTERN.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const file = path.join(SNAPSHOT_DIR, id);
    if (!fs.existsSync(file)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ id, data: JSON.parse(fs.readFileSync(file, "utf8")) });
  }
  const snapshots = listFiles().map(f => ({ id: f, ...parseName(f) })).filter(s => s.createdAt);
  return NextResponse.json({ snapshots });
}

// POST /api/snapshots — body: { data, reason: "manual" | "auto" }
export async function POST(request) {
  const body = await request.text();
  if (body.length > MAX_BYTES) return NextResponse.json({ error: "Too large" }, { status: 413 });
  const { data, reason } = JSON.parse(body);
  const kind = reason === "auto" ? "auto" : "manual";

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/:/g, "-").replace(".", "-");
  const id = `${stamp}_${kind}.json`;
  fs.writeFileSync(path.join(SNAPSHOT_DIR, id), JSON.stringify(data));

  // Keep only the newest MAX_SNAPSHOTS files
  for (const old of listFiles().slice(MAX_SNAPSHOTS)) {
    try { fs.unlinkSync(path.join(SNAPSHOT_DIR, old)); } catch {}
  }
  return NextResponse.json({ ok: true, id });
}
