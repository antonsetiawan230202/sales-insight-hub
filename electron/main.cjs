const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let basePath = null;

function getBasePath() {
  if (basePath) return basePath;
  // In production (packaged exe), app.getPath('exe') is the executable path.
  // In dev, fall back to the project root.
  try {
    const exePath = app.getPath("exe");
    const dir = path.dirname(exePath);
    // If running in dev (electron .), the exe is the electron binary — use cwd instead.
    // Detect dev by checking if the exe name is "electron" or similar.
    const exeName = path.basename(exePath).toLowerCase();
    if (exeName.startsWith("electron") && !exeName.includes("salesdashboard")) {
      basePath = process.cwd();
    } else {
      basePath = dir;
    }
  } catch {
    basePath = process.cwd();
  }
  return basePath;
}

function getDataDir() {
  return path.join(getBasePath(), "data", "raw");
}

function getJsonPath() {
  return path.join(getBasePath(), "dashboard-data.json");
}

function safeReadFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "Sales & Prospects Dashboard",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "..", "electron-dist", "index.html"));
}

app.whenReady().then(() => {
  // IPC: return base path
  ipcMain.handle("app:getBasePath", () => getBasePath());

  // IPC: read JSON database file
  ipcMain.handle("fs:readJson", () => {
    const buf = safeReadFile(getJsonPath());
    if (!buf) return null;
    try {
      return JSON.parse(buf.toString("utf-8"));
    } catch {
      return null;
    }
  });

  // IPC: write JSON database file
  ipcMain.handle("fs:writeJson", (_event, value) => {
    try {
      fs.writeFileSync(getJsonPath(), JSON.stringify(value), "utf-8");
      return true;
    } catch (err) {
      console.error("Failed to write dashboard-data.json", err);
      return false;
    }
  });

  // IPC: list bundled data files (.xlsx in data/raw/)
  ipcMain.handle("fs:listDataFiles", () => {
    const dir = getDataDir();
    try {
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith(".xlsx") || f.toLowerCase().endsWith(".xls"))
        .map((f) => ({ name: f, path: path.join(dir, f) }));
    } catch {
      return [];
    }
  });

  // IPC: read a bundled data file (returns ArrayBuffer)
  ipcMain.handle("fs:readDataFile", (_event, name) => {
    const filePath = path.join(getDataDir(), path.basename(name));
    const buf = safeReadFile(filePath);
    if (!buf) return null;
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  });

  // IPC: stat a bundled data file (returns mtime in ms)
  ipcMain.handle("fs:statDataFile", (_event, name) => {
    const filePath = path.join(getDataDir(), path.basename(name));
    try {
      if (!fs.existsSync(filePath)) return null;
      const stat = fs.statSync(filePath);
      return stat.mtimeMs;
    } catch {
      return null;
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
