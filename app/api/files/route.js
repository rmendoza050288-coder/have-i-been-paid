import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";

// Stable, OS-level app-data directory — independent of wherever the app's
// code happens to live on disk. Uploaded receipts/invoices must survive
// "updating to a new version" (re-cloning/re-downloading the project, or
// extracting a fresh build over the old folder). offline_files/ is
// gitignored and never shipped with the app, so if we kept storing uploads
// relative to process.cwd() (the project folder), replacing that folder
// with a new version would silently lose everything a user had uploaded.
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

const FILES_DIR = path.join(getAppDataDir(), "offline_files", "Have I Been Paid_");

// One-time migration: the first time this stable location is used, pull in
// any existing uploads from the legacy in-project offline_files folder so
// nothing already saved gets lost. No-op once the stable dir has been set up
// (e.g. the packaged Electron build, whose cwd is already the userData dir).
function ensureFilesDir() {
  if (fs.existsSync(FILES_DIR)) return;
  fs.mkdirSync(path.dirname(FILES_DIR), { recursive: true });
  const legacyDir = path.join(process.cwd(), "offline_files", "Have I Been Paid_");
  if (fs.existsSync(legacyDir) && path.resolve(legacyDir) !== path.resolve(FILES_DIR)) {
    try {
      fs.cpSync(legacyDir, FILES_DIR, { recursive: true });
      return;
    } catch (err) {
      console.error("[files] Failed to migrate legacy offline_files:", err);
    }
  }
  fs.mkdirSync(FILES_DIR, { recursive: true });
}
ensureFilesDir();

const MIME_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".html": "text/html",
};

function findFileRecursive(dir, name, depth = 0) {
  if (depth > 4) return null;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === name) return path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFileRecursive(path.join(dir, entry.name), name, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// GET /api/files?name=filename.pdf — serve a file from offline_files/
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");

  if (!name || name.includes("..") || name.includes("/") || name.includes("\\") || name.includes("\0")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const filePath = findFileRecursive(FILES_DIR, name);
  if (!filePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(FILES_DIR))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const ext = path.extname(name).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  let buffer;
  try { buffer = fs.readFileSync(resolved); } catch {
    return new NextResponse("Read error", { status: 500 });
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
    },
  });
}

// POST /api/files — save an uploaded file to offline_files/
export async function POST(req) {
  let formData;
  try { formData = await req.formData(); } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const name = file.name;
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\") || name.includes("\0")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const subfolder = formData.get("subfolder");
  if (subfolder && (subfolder.includes("..") || subfolder.includes("/") || subfolder.includes("\\") || subfolder.includes("\0"))) {
    return NextResponse.json({ error: "Invalid subfolder" }, { status: 400 });
  }

  const dir = subfolder ? path.join(FILES_DIR, subfolder) : FILES_DIR;
  const destPath = path.join(dir, name);
  if (!path.resolve(destPath).startsWith(path.resolve(FILES_DIR))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }

  try {
    fs.mkdirSync(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
  } catch (err) {
    return NextResponse.json({ error: "Save failed: " + err.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, name });
}
