// electron/main.mjs — Vỏ Windows của MedSlide VI Studio: chạy máy chủ cục bộ trong tiến trình chính,
// mở cửa sổ ứng dụng, xuất PDF bằng Chromium (printToPDF), lưu file qua hộp thoại Windows.
import { app, BrowserWindow, shell, dialog, Menu, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
process.env.MEDSLIDE_UI_DIR = path.join(ROOT, "app");

let win = null;
let baseUrl = "";

async function boot() {
  const { startServer } = await import("../server/index.mjs");
  try {
    ({ url: baseUrl } = await startServer({ port: 47231 }));
  } catch {
    ({ url: baseUrl } = await startServer({ port: 0 }));
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    title: "MedSlide VI Studio", autoHideMenuBar: true, backgroundColor: "#F4F6F8",
    icon: path.join(ROOT, "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(baseUrl) && /deck\.html/.test(url)) return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, backgroundColor: "#1E1E1E", title: "Trình chiếu" } };
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL(baseUrl + "/");
}

function registerIpc() {
  ipcMain.handle("file:saveAs", async (_e, src, suggested) => {
    if (!src || !fs.existsSync(src)) return { canceled: true };
    const ext = path.extname(src).slice(1);
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath("documents"), suggested || path.basename(src)), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (r.canceled || !r.filePath) return { canceled: true };
    fs.copyFileSync(src, r.filePath);
    return { canceled: false, path: r.filePath };
  });
  ipcMain.handle("file:exportPdf", async (_e, projectId, suggested) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath("documents"), suggested || `${projectId}.pdf`), filters: [{ name: "PDF", extensions: ["pdf"] }] });
    if (r.canceled || !r.filePath) return { canceled: true };
    const pw = new BrowserWindow({ show: false, width: 1920, height: 1080, webPreferences: { offscreen: false } });
    try {
      await pw.loadURL(`${baseUrl}/api/projects/${encodeURIComponent(projectId)}/deck.html?print=1`);
      await new Promise((ok) => setTimeout(ok, 1200));
      const pdf = await pw.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: "none" } });
      fs.writeFileSync(r.filePath, pdf);
      return { canceled: false, path: r.filePath };
    } finally { pw.destroy(); }
  });
  ipcMain.handle("file:pick", async (_e, kind) => {
    const filters = kind === "image" ? [{ name: "Hình ảnh", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }] : [{ name: "Tài liệu", extensions: ["pdf", "docx", "txt", "md"] }];
    const r = await dialog.showOpenDialog(win, { properties: ["openFile", "multiSelections"], filters });
    if (r.canceled) return [];
    return r.filePaths.map((p) => ({ name: path.basename(p), base64: fs.readFileSync(p).toString("base64") }));
  });
  ipcMain.handle("shell:openPath", (_e, p) => shell.openPath(String(p || "")));
  ipcMain.handle("shell:showItem", (_e, p) => { shell.showItemInFolder(String(p || "")); return true; });
  ipcMain.handle("shell:openExternal", (_e, u) => (/^https?:\/\//.test(u) ? shell.openExternal(u) : false));
}

// Kiểm thử khói (CI): chụp cửa sổ, mở bài mẫu, xuất PDF bằng printToPDF rồi thoát
async function smoke(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  await new Promise((ok) => win.webContents.once("did-finish-load", ok));
  await new Promise((ok) => setTimeout(ok, 2500));
  fs.writeFileSync(path.join(outDir, "window.png"), (await win.webContents.capturePage()).toPNG());
  const r = await fetch(baseUrl + "/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sample: true }) });
  const proj = await r.json();
  const pw = new BrowserWindow({ show: false, width: 1920, height: 1080 });
  await pw.loadURL(`${baseUrl}/api/projects/${proj.id}/deck.html?print=1`);
  await new Promise((ok) => setTimeout(ok, 1500));
  fs.writeFileSync(path.join(outDir, "sample.pdf"), await pw.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: "none" } }));
  console.log("SMOKE_OK", baseUrl);
  app.exit(0);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    try { registerIpc(); await boot(); createWindow(); if (process.env.MEDSLIDE_SMOKE) smoke(process.env.MEDSLIDE_SMOKE); }
    catch (e) { dialog.showErrorBox("MedSlide VI Studio", e?.stack || String(e)); app.quit(); }
  });
  app.on("window-all-closed", () => app.quit());
}
