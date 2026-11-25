// store.mjs — Cấu hình, kho khóa API (lưu cục bộ) và dự án slide
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const home = os.homedir();
const isWin = process.platform === "win32";

export const DATA_DIR = process.env.MEDSLIDE_DATA_DIR
  || (isWin ? path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "MedSlide VI Studio") : path.join(home, ".medslide-vi"));
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

function defaultProjectsDir() {
  const docs = path.join(home, "Documents");
  return path.join(fs.existsSync(docs) ? docs : home, "MedSlide VI Studio");
}

const DEFAULT_CONFIG = {
  engine: "",
  model: "",
  fallback: [],
  apiKeys: {},
  projectsDir: "",
  presenter: { name: "", title: "", affiliation: "" },
};

let cache = null;

export function getConfig() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) };
  } catch {
    cache = { ...DEFAULT_CONFIG };
  }
  return cache;
}

export function updateConfig(patch = {}) {
  const cur = getConfig();
  const next = { ...cur };
  for (const k of ["engine", "model", "projectsDir"]) if (typeof patch[k] === "string") next[k] = patch[k].trim();
  if (Array.isArray(patch.fallback)) next.fallback = patch.fallback.filter((x) => typeof x === "string").slice(0, 4);
  if (patch.presenter && typeof patch.presenter === "object") next.presenter = { ...cur.presenter, ...patch.presenter };
  if (patch.apiKeys && typeof patch.apiKeys === "object") {
    next.apiKeys = { ...cur.apiKeys };
    for (const [k, v] of Object.entries(patch.apiKeys)) {
      if (!/^[A-Z_]+$/.test(k)) continue;
      if (v === null || v === "") delete next.apiKeys[k];
      else if (typeof v === "string") next.apiKeys[k] = v.trim();
    }
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  cache = next;
  return getPublicConfig();
}

export function getPublicConfig() {
  const c = getConfig();
  const masked = {};
  for (const [k, v] of Object.entries(c.apiKeys || {})) masked[k] = v ? `${String(v).slice(0, 4)}…${String(v).slice(-4)}` : "";
  return { ...c, apiKeys: masked, projectsDir: projectsDir(), dataDir: DATA_DIR };
}

export function projectsDir() {
  const d = getConfig().projectsDir || defaultProjectsDir();
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// ---------- dự án ----------
export function slugify(s) {
  return String(s || "bai-trinh-bay")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "bai-trinh-bay";
}

function projectFile(id) {
  if (!/^[a-z0-9-]+$/.test(String(id))) throw new Error("Mã dự án không hợp lệ.");
  return path.join(projectsDir(), id, "project.json");
}

export function projectFolder(id) {
  return path.dirname(projectFile(id));
}

export function listProjects() {
  const root = projectsDir();
  const out = [];
  for (const name of fs.readdirSync(root)) {
    const f = path.join(root, name, "project.json");
    try {
      const p = JSON.parse(fs.readFileSync(f, "utf8"));
      out.push({
        id: p.id, title: p.brief?.topic || p.deck?.meta?.title || p.id,
        stage: p.stage || "brief", updatedAt: p.updatedAt || 0,
        slides: p.deck?.slides?.length || 0, theme: p.deck?.meta?.theme || p.brief?.theme || "",
      });
    } catch { /* bỏ qua thư mục lạ */ }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createProject(brief = {}) {
  let id = slugify(brief.topic);
  let n = 1;
  while (fs.existsSync(path.join(projectsDir(), id))) id = `${slugify(brief.topic)}-${++n}`;
  const p = {
    id, version: 1, createdAt: Date.now(), updatedAt: Date.now(), stage: "brief",
    brief: { ...brief }, questions: [], answers: {}, sources: [], evidence: [], plan: null, deck: null, audit: null, log: [],
  };
  fs.mkdirSync(path.join(projectsDir(), id, "out"), { recursive: true });
  saveProject(p);
  return p;
}

export function loadProject(id) {
  return JSON.parse(fs.readFileSync(projectFile(id), "utf8"));
}

export function saveProject(p) {
  p.updatedAt = Date.now();
  const f = projectFile(p.id);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(p, null, 2), "utf8");
  fs.renameSync(tmp, f);
  return p;
}

export function deleteProject(id) {
  const dir = projectFolder(id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

export function logStep(p, msg) {
  p.log = [...(p.log || []), { t: Date.now(), msg }].slice(-200);
}
