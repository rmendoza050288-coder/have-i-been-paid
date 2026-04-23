// Node.js runtime required for Buffer (used in binary upload + OCR)
export const runtime = "nodejs";

// ── Access token cache (module-level singleton) ─────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;

// Workload Identity Federation token exchange:
//   Vercel OIDC token → Google STS federated token → SA impersonation access token
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  const oidcToken = process.env.VERCEL_OIDC_TOKEN;
  const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const provider = process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER; // projects/NUM/locations/global/workloadIdentityPools/POOL/providers/PROVIDER

  if (!oidcToken) throw new Error("VERCEL_OIDC_TOKEN not available — enable OIDC in Vercel project settings");
  if (!saEmail) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL env var not set");
  if (!provider) throw new Error("GOOGLE_WORKLOAD_IDENTITY_PROVIDER env var not set");

  // Step 1: Exchange Vercel OIDC token for a Google STS federated access token
  const stsRes = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: `//iam.googleapis.com/${provider}`,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      subject_token: oidcToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    }),
  });
  const stsData = await stsRes.json();
  if (!stsData.access_token) throw new Error("STS token exchange failed: " + JSON.stringify(stsData));

  // Step 2: Impersonate service account to get a Drive-scoped access token
  const impRes = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stsData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scope: ["https://www.googleapis.com/auth/drive"],
        lifetime: "3600s",
      }),
    }
  );
  const impData = await impRes.json();
  if (!impData.accessToken) throw new Error("Service account impersonation failed: " + JSON.stringify(impData));

  cachedToken = impData.accessToken;
  tokenExpiry = new Date(impData.expireTime).getTime();
  return cachedToken;
}

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    // Check if WIF credentials are configured
    if (action === "ping") {
      const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const provider = process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER;
      if (!email || !provider) return Response.json({ ok: false, error: "not_configured" });
      return Response.json({ ok: true, email });
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
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const provider = process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER;
    return Response.json({ ok: !!(email && provider), email: email || null });
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
