import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILES_DIR = path.join(process.cwd(), "offline_files", "Have I Been Paid_");

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
