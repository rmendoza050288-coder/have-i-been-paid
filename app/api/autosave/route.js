import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

// Stable, OS-level app-data directory — same convention as app/api/files/route.js.
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

const AUTOSAVE_PATH = path.join(getAppDataDir(), "autosave.json");
const MAX_BYTES = 25 * 1024 * 1024; // 25MB safety cap

// This exists purely as a safety net: browser localStorage writes are
// committed to disk by the browser itself on an internal, asynchronous
// timer. If the browser process is fully quit very shortly after a write
// (e.g. closing the browser + terminal right after saving an invoice), that
// write can be lost even though it appeared to succeed in the live session.
// This file is written synchronously by our own server the moment data
// changes, so it survives even an abrupt browser quit, and the app falls
// back to it on load if localStorage comes back unexpectedly empty.

// GET /api/autosave — read the last snapshot.
export async function GET() {
  try {
    if (!fs.existsSync(AUTOSAVE_PATH)) return NextResponse.json({ data: null });
    const raw = fs.readFileSync(AUTOSAVE_PATH, "utf8");
    return NextResponse.json({ data: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ data: null });
  }
}

// POST /api/autosave — overwrite the snapshot with the latest app data.
export async function POST(req) {
  let raw;
  try { raw = await req.text(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!raw || raw.length > MAX_BYTES) {
    return NextResponse.json({ error: "Invalid or oversized payload" }, { status: 400 });
  }
  let body;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  try {
    fs.mkdirSync(path.dirname(AUTOSAVE_PATH), { recursive: true });
    fs.writeFileSync(AUTOSAVE_PATH, raw);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
