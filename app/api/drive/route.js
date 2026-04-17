import { createSign } from "crypto";
import { readFileSync } from "fs";

// ── Credential loading ──────────────────────────────────────────────────────
function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    return JSON.parse(readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE, "utf8"));
  }
  return null;
}

// ── Access token cache (module-level singleton) ─────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  const creds = getCredentials();
  if (!creds) throw new Error("Service account not configured");

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const b64url = (str) => Buffer.from(str).toString("base64url");
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claim));
  const signingInput = `${header}.${payload}`;

  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const sig = sign.sign(creds.private_key, "base64url");

  const jwt = `${signingInput}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Token exchange failed: " + JSON.stringify(data));

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000;
  return cachedToken;
}

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    // Check if service account is configured
    if (action === "ping") {
      const creds = getCredentials();
      if (!creds) return Response.json({ ok: false, error: "not_configured" });
      if (!creds.client_email || !creds.private_key) return Response.json({ ok: false, error: "invalid_credentials" });
      return Response.json({ ok: true, email: creds.client_email });
    }

    const token = await getAccessToken();
    const auth = { Authorization: `Bearer ${token}` };

    // List files / folders
    if (action === "listFiles") {
      const { q } = params;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        { headers: auth }
      );
      return Response.json(await res.json());
    }

    // Create folder
    if (action === "createFolder") {
      const { name, parents } = params;
      const res = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          ...(parents?.length ? { parents } : {}),
        }),
      });
      return Response.json(await res.json());
    }

    // Create JSON file + upload content in two steps
    if (action === "createFile") {
      const { name, parents, content } = params;
      const metaRes = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(parents?.length ? { parents } : {}) }),
      });
      const meta = await metaRes.json();
      if (!meta.id) return Response.json({ error: "File creation failed", detail: meta }, { status: 500 });
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${meta.id}?uploadType=media&supportsAllDrives=true`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      return Response.json({ id: meta.id });
    }

    // Update existing JSON file
    if (action === "updateFile") {
      const { fileId, content } = params;
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      return Response.json({ ok: true });
    }

    // Read a JSON file's content
    if (action === "readFile") {
      const { fileId } = params;
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
        headers: auth,
      });
      const data = await res.json();
      return Response.json({ content: data });
    }

    // Upload a binary file (receipts, invoice scans)
    if (action === "uploadBinary") {
      const { fileName, fileBase64, mimeType, parents } = params;
      const buf = Buffer.from(fileBase64, "base64");
      const metaRes = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name: fileName, ...(parents?.length ? { parents } : {}) }),
      });
      const meta = await metaRes.json();
      if (!meta.id) return Response.json({ error: "File creation failed" }, { status: 500 });
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${meta.id}?uploadType=media&supportsAllDrives=true`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": mimeType },
        body: buf,
      });
      return Response.json({ id: meta.id });
    }

    // OCR: upload file as Google Doc, export as plain text, delete temp doc
    if (action === "ocrFile") {
      const { fileBase64, mimeType, parents } = params;
      const boundary = "ocr_" + Date.now();
      const meta = JSON.stringify({
        name: `_ocr_${Date.now()}`,
        mimeType: "application/vnd.google-apps.document",
        ...(parents?.length ? { parents } : {}),
      });
      // Multipart body using base64 transfer encoding (same as Drive UI upload)
      const multipart = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        meta,
        `--${boundary}`,
        `Content-Type: ${mimeType}`,
        "Content-Transfer-Encoding: base64",
        "",
        fileBase64,
        `--${boundary}--`,
      ].join("\r\n");

      const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
        method: "POST",
        headers: {
          ...auth,
          "Content-Type": `multipart/related; boundary="${boundary}"`,
        },
        body: multipart,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        return Response.json(
          { error: "OCR upload failed: " + (err.error?.message || uploadRes.status) },
          { status: 500 }
        );
      }

      const ocrDoc = await uploadRes.json();
      if (!ocrDoc.id) return Response.json({ error: "No OCR doc ID returned" }, { status: 500 });

      const textRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${ocrDoc.id}/export?mimeType=text/plain`,
        { headers: auth }
      );
      const text = await textRes.text();

      // Delete temp doc best-effort
      fetch(`https://www.googleapis.com/drive/v3/files/${ocrDoc.id}?supportsAllDrives=true`, {
        method: "DELETE",
        headers: auth,
      }).catch(() => {});

      return Response.json({ text });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[/api/drive]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ── GET handler: ping + file proxy for in-app preview ────────────────────────
export async function GET(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "ping") {
    const creds = getCredentials();
    return Response.json({ ok: !!creds && !!(creds.client_email && creds.private_key) });
  }

  if (action === "proxy") {
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });
    try {
      const token = await getAccessToken();
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const contentType = res.headers.get("content-type") || "application/octet-stream";
      const buf = await res.arrayBuffer();
      return new Response(buf, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": "inline",
        },
      });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  return Response.json({ error: "Use POST" }, { status: 405 });
}
