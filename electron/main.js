const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const isDev = !app.isPackaged;

// ── Path helpers ─────────────────────────────────────────────────────────────

/** Files bundled with the app (read-only inside the .app bundle). */
function getResourcePath(...parts) {
  return isDev
    ? path.join(__dirname, "..", ...parts)
    : path.join(process.resourcesPath, ...parts);
}

/** User-writable app data directory. */
function getUserDataPath(...parts) {
  return path.join(app.getPath("userData"), ...parts);
}

// ── First-run setup ──────────────────────────────────────────────────────────

/**
 * Copy the bundled offline_files to the user's app-data dir on first launch.
 * This makes them writable (the .app bundle itself is read-only).
 */
function ensureOfflineFiles() {
  const src = getResourcePath("offline_files");
  const dest = getUserDataPath("offline_files");
  if (!fs.existsSync(dest) && fs.existsSync(src)) {
    try {
      fs.cpSync(src, dest, { recursive: true });
    } catch (err) {
      console.error("[setup] Failed to copy offline_files:", err);
    }
  }
}

// ── Server management ────────────────────────────────────────────────────────

let nextProcess = null;

function startNextServer() {
  const standaloneDir = getResourcePath("app");
  const serverScript = path.join(standaloneDir, "server.js");

  // The server's cwd is the userData dir so that
  // process.cwd()/offline_files resolves correctly.
  const serverCwd = getUserDataPath();
  fs.mkdirSync(serverCwd, { recursive: true });

  const env = {
    ...process.env,
    // ELECTRON_RUN_AS_NODE makes the Electron binary behave like Node.js
    ELECTRON_RUN_AS_NODE: "1",
    PORT: "3000",
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
  };

  const credPath = getUserDataPath("credentials.json");
  if (fs.existsSync(credPath)) {
    try {
      env.GOOGLE_SERVICE_ACCOUNT_JSON = fs.readFileSync(credPath, "utf8").trim();
    } catch (err) {
      console.error("[setup] Failed to read credentials:", err);
    }
  }

  nextProcess = spawn(process.execPath, [serverScript], {
    cwd: serverCwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  nextProcess.stdout.on("data", (d) => console.log("[Next]", d.toString().trim()));
  nextProcess.stderr.on("data", (d) => console.error("[Next]", d.toString().trim()));
  nextProcess.on("error", (err) => console.error("[Next] Process error:", err));
  nextProcess.on("exit", (code) => console.log("[Next] Exited with code:", code));
}

/** Poll localhost:3000 until it responds or we give up. */
function waitForServer(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if (attempts >= maxAttempts) {
        return reject(new Error("Server did not start in time"));
      }
      attempts++;
      const req = http.get(`http://127.0.0.1:${port}`, () => resolve());
      req.on("error", () => setTimeout(check, 1000));
      req.end();
    };
    check();
  });
}

// ── Credential setup dialog ──────────────────────────────────────────────────

async function promptForCredentials(win) {
  const result = await dialog.showOpenDialog(win, {
    title: "Select Google Service Account JSON",
    message:
      "Select your Google Service Account credentials file to enable Google Drive sync.",
    filters: [{ name: "JSON Files", extensions: ["json"] }],
    properties: ["openFile"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const dest = getUserDataPath("credentials.json");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(result.filePaths[0], dest);
    return true;
  }
  return false;
}

// ── App lifecycle ────────────────────────────────────────────────────────────

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    title: "Have I Been Paid?",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Open external links in the system browser instead of a new Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

app.whenReady().then(async () => {
  ensureOfflineFiles();

  const win = createWindow();

  // Show a lightweight loading screen while the server starts
  win.loadURL(
    "data:text/html," +
      encodeURIComponent(
        `<html>
          <body style="margin:0;background:#0f172a;display:flex;align-items:center;
                       justify-content:center;height:100vh">
            <p style="color:#94a3b8;font-family:system-ui,sans-serif;font-size:18px">
              Starting Have I Been Paid?…
            </p>
          </body>
        </html>`
      )
  );

  // First-run: offer credential setup
  const credPath = getUserDataPath("credentials.json");
  if (!fs.existsSync(credPath)) {
    const choice = dialog.showMessageBoxSync(win, {
      type: "info",
      title: "Setup — Have I Been Paid?",
      message: "Google Drive credentials not found.",
      detail:
        "Select your Google Service Account JSON file to enable Drive sync, " +
        "or skip to use offline mode only.\n\n" +
        "You can add credentials later by replacing the file at:\n" +
        getUserDataPath("credentials.json"),
      buttons: ["Select Credentials File", "Skip — Offline Mode Only"],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice === 0) {
      await promptForCredentials(win);
    }
  }

  startNextServer();

  try {
    await waitForServer(3000);
    win.loadURL("http://127.0.0.1:3000");
  } catch {
    dialog.showErrorBox(
      "Startup Failed",
      "The server failed to start. Please try quitting and reopening the app."
    );
    app.quit();
  }
});

app.on("activate", () => {
  // macOS: re-create the window when clicking the dock icon with no windows open
  if (!mainWindow) {
    const win = createWindow();
    win.loadURL("http://127.0.0.1:3000");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
});
