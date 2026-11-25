// index.mjs — Máy chủ cục bộ của MedSlide VI Studio (chỉ nghe 127.0.0.1)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listEngines, startLogin, startInstall, getJob, sendJobInput, stopJob, pingEngine } from "./drivers.mjs";
import { getPublicConfig, updateConfig, listProjects, createProject, loadProject, saveProject, deleteProject, projectFolder, logStep } from "./store.mjs";
import { runGrill, runPlan, runBuild, runRevise, runReview, normalizeSlide } from "./pipeline.mjs";
import { pubmedSearch, pubmedRecords, europePmcFullText, clinicalTrial, crossref } from "./evidence.mjs";
import { extractText } from "./sources.mjs";
import { renderDeckHtml } from "./render-html.mjs";
import { renderDeckPptx } from "./render-pptx.mjs";
import { auditDeck } from "./audit.mjs";
import { THEMES } from "./themes.mjs";
import { DECK_TYPES } from "./prompts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.0.1";
const UI_DIR = process.env.MEDSLIDE_UI_DIR && fs.existsSync(process.env.MEDSLIDE_UI_DIR) ? process.env.MEDSLIDE_UI_DIR : path.resolve(__dirname, "..", "app");
const SAMPLE = path.resolve(__dirname, "..", "test", "fixtures", "sample-project.json");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

function send(res, code, body, type = "application/json; charset=utf-8", extra = {}) {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", ...extra });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const ok = (res, data) => send(res, 200, data);
const fail = (res, e, code = 400) => send(res, code, { error: e?.message || String(e) });

function readBody(req, limit = 80 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("Dữ liệu quá lớn.")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

// ---------- tác vụ dài (gọi AI) ----------
const TASKS = new Map();
let seq = 0;
function startTask(label, fn) {
  const id = `t${++seq}-${Date.now().toString(36)}`;
  const t = { id, label, status: "running", progress: null, error: "", result: null, startedAt: Date.now() };
  TASKS.set(id, t);
  Promise.resolve().then(() => fn((pr) => { t.progress = pr; })).then((r) => { t.status = "done"; t.result = r; }).catch((e) => { t.status = "error"; t.error = e?.message || String(e); });
  setTimeout(() => TASKS.delete(id), 3600_000).unref();
  return t;
}

function withProject(id, fn) {
  return async (onProgress) => {
    const p = loadProject(id);
    await fn(p, onProgress);
    saveProject(p);
    return { project: p };
  };
}

function pickBrief(b = {}) {
  const keys = ["topic", "deckType", "audience", "minutes", "lang", "presenter", "affiliation", "event", "goal", "extra", "theme", "pubmedQuery", "coreMessageDraft"];
  const out = {};
  for (const k of keys) if (b[k] !== undefined) out[k] = k === "minutes" ? Math.max(3, Math.min(120, +b[k] || 15)) : String(b[k]);
  return out;
}

async function route(req, res, url) {
  const p = url.pathname;
  const m = (re) => re.exec(p);
  let mm;

  if (p === "/api/health") return ok(res, { ok: true, version: VERSION, app: "MedSlide VI Studio" });
  if (p === "/api/meta") return ok(res, { version: VERSION, themes: Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, { name: v.name, desc: v.desc, primary: v.primary, bg: v.bg, int: v.int }])), deckTypes: DECK_TYPES });

  // ----- AI -----
  if (p === "/api/engines") return ok(res, await listEngines());
  if (p === "/api/engines/login" && req.method === "POST") { const b = await readBody(req); return ok(res, startLogin(b.id, { mode: b.mode })); }
  if (p === "/api/engines/install" && req.method === "POST") { const b = await readBody(req); return ok(res, startInstall(b.id, { mode: b.mode })); }
  if (p === "/api/engines/ping" && req.method === "POST") { const b = await readBody(req); return ok(res, await pingEngine(b.id, b.model)); }
  if ((mm = m(/^\/api\/jobs\/([\w-]+)$/))) return ok(res, getJob(mm[1]) || { status: "missing" });
  if ((mm = m(/^\/api\/jobs\/([\w-]+)\/input$/)) && req.method === "POST") { const b = await readBody(req); return ok(res, sendJobInput(mm[1], b.text)); }
  if ((mm = m(/^\/api\/jobs\/([\w-]+)\/stop$/)) && req.method === "POST") return ok(res, stopJob(mm[1]));
  if (p === "/api/config") {
    if (req.method === "POST") return ok(res, updateConfig(await readBody(req)));
    return ok(res, getPublicConfig());
  }
  if ((mm = m(/^\/api\/tasks\/([\w-]+)$/))) {
    const t = TASKS.get(mm[1]);
    if (!t) return ok(res, { status: "missing" });
    return ok(res, { ...t, result: t.status === "done" ? t.result : null });
  }

  // ----- bằng chứng -----
  if (p === "/api/pubmed/search" && req.method === "POST") { const b = await readBody(req); return ok(res, await pubmedSearch(b.query, { retmax: Math.min(40, +b.retmax || 15), minYear: b.minYear || "", sort: b.sort || "relevance" })); }
  if (p === "/api/trial" && req.method === "POST") { const b = await readBody(req); return ok(res, await clinicalTrial(b.nct)); }

  // ----- dự án -----
  if (p === "/api/projects" && req.method === "GET") return ok(res, listProjects());
  if (p === "/api/projects" && req.method === "POST") {
    const b = await readBody(req);
    if (b.sample) {
      const s = JSON.parse(fs.readFileSync(SAMPLE, "utf8"));
      const np = createProject({ ...s.brief, topic: s.brief.topic + " (mẫu)" });
      Object.assign(np, { evidence: s.evidence, deck: s.deck, stage: "deck", plan: { coreMessage: "", approved: true, slides: s.deck.slides.map((x, i) => ({ n: i + 1, layout: x.layout, title: x.title })) } });
      return ok(res, saveProject(np));
    }
    return ok(res, createProject(pickBrief(b.brief || b)));
  }
  if ((mm = m(/^\/api\/projects\/([a-z0-9-]+)$/))) {
    const id = mm[1];
    if (req.method === "GET") return ok(res, loadProject(id));
    if (req.method === "DELETE") { deleteProject(id); return ok(res, { ok: true }); }
    if (req.method === "POST") {
      const b = await readBody(req);
      const pr = loadProject(id);
      if (b.brief) pr.brief = { ...pr.brief, ...pickBrief(b.brief) };
      if (b.answers) pr.answers = { ...pr.answers, ...b.answers };
      if (b.plan) pr.plan = { ...pr.plan, ...b.plan };
      if (b.stage) pr.stage = b.stage;
      if (b.theme && pr.deck) pr.deck.meta.theme = b.theme;
      if (b.deckMeta && pr.deck) pr.deck.meta = { ...pr.deck.meta, ...b.deckMeta };
      if (Array.isArray(b.evidenceSelect)) for (const e of pr.evidence || []) e.selected = b.evidenceSelect.includes(e.id);
      if (b.removeEvidence) pr.evidence = (pr.evidence || []).filter((e) => e.id !== b.removeEvidence);
      if (b.removeSource) pr.sources = (pr.sources || []).filter((s) => s.id !== b.removeSource);
      if (b.slide && pr.deck) {
        const i = pr.deck.slides.findIndex((s) => s.id === b.slide.id);
        if (i >= 0) pr.deck.slides[i] = normalizeSlide(b.slide, pr.deck.slides[i]);
      }
      if (b.slideOp && pr.deck) {
        const { op, id: sid } = b.slideOp;
        const i = pr.deck.slides.findIndex((s) => s.id === sid);
        if (op === "delete" && i >= 0) pr.deck.slides.splice(i, 1);
        if (op === "up" && i > 0) [pr.deck.slides[i - 1], pr.deck.slides[i]] = [pr.deck.slides[i], pr.deck.slides[i - 1]];
        if (op === "down" && i >= 0 && i < pr.deck.slides.length - 1) [pr.deck.slides[i + 1], pr.deck.slides[i]] = [pr.deck.slides[i], pr.deck.slides[i + 1]];
        if (op === "duplicate" && i >= 0) pr.deck.slides.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(pr.deck.slides[i])), id: `s${Date.now().toString(36)}` });
        if (op === "add") pr.deck.slides.splice(i + 1, 0, normalizeSlide({ ...(b.slideOp.slide || { layout: "bullets", title: "Tiêu đề khẳng định", points: ["[CẦN BỔ SUNG: nội dung]"] }), id: `s${Date.now().toString(36)}` }));
        pr.deck.slides.forEach((s, k) => { for (const c of pr.deck.claims || []) if (c.slideId === s.id) c.slide = k + 1; });
      }
      return ok(res, saveProject(pr));
    }
  }
  if ((mm = m(/^\/api\/projects\/([a-z0-9-]+)\/sources$/)) && req.method === "POST") {
    const b = await readBody(req);
    const pr = loadProject(mm[1]);
    const added = [];
    for (const f of b.files || []) {
      const { text, pages } = b.text && !f.base64 ? { text: String(f.text || ""), pages: 0 } : await extractText(f.name, Buffer.from(f.base64 || "", "base64"));
      const sid = `nguon${(pr.sources?.length || 0) + added.length + 1}`;
      added.push({ id: sid, name: f.name || "Văn bản dán", pages, chars: text.length, text, citation: f.citation || "", addedAt: Date.now() });
    }
    if (b.paste) added.push({ id: `nguon${(pr.sources?.length || 0) + added.length + 1}`, name: b.pasteName || "Văn bản dán", pages: 0, chars: b.paste.length, text: String(b.paste), citation: b.citation || "", addedAt: Date.now() });
    pr.sources = [...(pr.sources || []), ...added];
    logStep(pr, `Thêm ${added.length} tài liệu nguồn`);
    return ok(res, saveProject(pr));
  }
  if ((mm = m(/^\/api\/projects\/([a-z0-9-]+)\/evidence$/)) && req.method === "POST") {
    const b = await readBody(req);
    const pr = loadProject(mm[1]);
    let items = [];
    if (b.pmids?.length) items = await pubmedRecords(b.pmids);
    if (b.doi) items.push({ ...(await crossref(b.doi)), id: "", abstract: "" });
    const used = new Set((pr.evidence || []).map((e) => e.id));
    for (const it of items) {
      if ((pr.evidence || []).some((e) => (it.pmid && e.pmid === it.pmid) || (it.doi && e.doi === it.doi))) continue;
      let base = it.id || ((it.authors?.[0] || "ref").split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "") + (it.year || "")), nid = base, k = 1;
      while (used.has(nid)) nid = base + String.fromCharCode(97 + k++);
      used.add(nid);
      if (it.pmcid && b.fulltext) { try { it.fulltext = await europePmcFullText(it.pmcid); it.access = "full-text"; } catch { /* chỉ abstract */ } }
      pr.evidence = [...(pr.evidence || []), { ...it, id: nid, selected: true }];
    }
    logStep(pr, `Thêm ${items.length} bài báo từ tra cứu`);
    return ok(res, saveProject(pr));
  }
  if ((mm = m(/^\/api\/projects\/([a-z0-9-]+)\/fulltext$/)) && req.method === "POST") {
    const b = await readBody(req);
    const pr = loadProject(mm[1]);
    const e = (pr.evidence || []).find((x) => x.id === b.id);
    if (!e?.pmcid) throw new Error("Bài này không có bản toàn văn mở trên Europe PMC.");
    e.fulltext = await europePmcFullText(e.pmcid); e.access = "full-text";
    return ok(res, saveProject(pr));
  }

  // tác vụ AI
  const aiOps = {
    grill: (id) => withProject(id, (pr) => runGrill(pr)),
    plan: (id) => withProject(id, (pr) => runPlan(pr)),
    build: (id) => withProject(id, (pr, prog) => runBuild(pr, prog)),
    review: (id) => withProject(id, async (pr) => { const r = await runReview(pr); pr.review = { ...r, at: Date.now() }; return { project: pr }; }),
  };
  if ((mm = m(/^\/api\/projects\/([a-z0-9-]+)\/(grill|plan|build|review)$/)) && req.method === "POST") {
    const [, id, op] = mm;
    const labels = { grill: "AI đang soạn câu hỏi phỏng vấn", plan: "AI đang lập dàn ý", build: "AI đang dựng slide", review: "AI đang phản biện bằng chứng" };
    return ok(res, startTask(labels[op], aiOps[op](id)));
  }
  if ((mm = m(/^\/api\/projects\/([a-z0-9-]+)\/revise$/)) && req.method === "POST") {
    const b = await readBody(req);
    return ok(res, startTask("AI đang sửa slide", withProject(mm[1], (pr) => runRevise(pr, b.slideId, String(b.instruction || "")))));
  }
  if ((mm = m(/^\/api\/projects\/([a-z0-9-]+)\/audit$/)) && req.method === "POST") {
    const b = await readBody(req);
    return ok(res, startTask("Đang kiểm định", withProject(mm[1], async (pr) => { pr.audit = await auditDeck(pr, { verifyRefs: b.verifyRefs !== false }); pr.stage = pr.stage === "deck" ? "audit" : pr.stage; return { project: pr }; })));
  }

  // ----- xem trước & xuất -----
  if ((mm = m(/^\/api\/projects\/([a-z0-9-]+)\/deck\.html$/))) {
    const pr = loadProject(mm[1]);
    if (!pr.deck) return send(res, 404, "<p style='font-family:sans-serif'>Chưa có slide.</p>", "text/html; charset=utf-8");
    const deck = url.searchParams.get("theme") ? { ...pr.deck, meta: { ...pr.deck.meta, theme: url.searchParams.get("theme") } } : pr.deck;
    return send(res, 200, renderDeckHtml(deck, pr, { print: url.searchParams.has("print") }), "text/html; charset=utf-8");
  }
  if (p === "/api/theme-preview") {
    const s = JSON.parse(fs.readFileSync(SAMPLE, "utf8"));
    s.deck.meta.theme = url.searchParams.get("theme") || "lam-sang";
    const keep = (url.searchParams.get("slides") || "1,4,5").split(",").map((x) => +x - 1);
    s.deck.slides = keep.map((i) => s.deck.slides[i]).filter(Boolean);
    return send(res, 200, renderDeckHtml(s.deck, s), "text/html; charset=utf-8");
  }
  if ((mm = m(/^\/api\/projects\/([a-z0-9-]+)\/export$/)) && req.method === "POST") {
    const b = await readBody(req);
    const pr = loadProject(mm[1]);
    if (!pr.deck) throw new Error("Chưa có slide để xuất.");
    const outDir = path.join(projectFolder(pr.id), "out");
    fs.mkdirSync(outDir, { recursive: true });
    const base = pr.id;
    let file;
    if (b.format === "pptx") { file = path.join(outDir, `${base}.pptx`); fs.writeFileSync(file, await renderDeckPptx(pr.deck, pr)); }
    else if (b.format === "html") { file = path.join(outDir, `${base}.html`); fs.writeFileSync(file, renderDeckHtml(pr.deck, pr), "utf8"); }
    else if (b.format === "json") { file = path.join(outDir, `${base}.medslide.json`); fs.writeFileSync(file, JSON.stringify(pr, null, 2), "utf8"); }
    else throw new Error("Định dạng xuất không hợp lệ.");
    logStep(pr, `Xuất ${b.format.toUpperCase()}`); saveProject(pr);
    return ok(res, { file, dir: outDir, name: path.basename(file) });
  }
  if ((mm = m(/^\/api\/projects\/([a-z0-9-]+)\/download$/))) {
    const pr = loadProject(mm[1]);
    const name = path.basename(url.searchParams.get("name") || "");
    const f = path.join(projectFolder(pr.id), "out", name);
    if (!name || !fs.existsSync(f)) return fail(res, new Error("Không có file."), 404);
    return send(res, 200, fs.readFileSync(f), "application/octet-stream", { "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });
  }

  // ----- giao diện -----
  if (req.method === "GET" && !p.startsWith("/api/")) {
    const rel = p === "/" ? "index.html" : decodeURIComponent(p).replace(/^\/+/, "");
    const f = path.resolve(UI_DIR, rel);
    if (!f.startsWith(UI_DIR) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return send(res, 404, "Not found", "text/plain");
    return send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || "application/octet-stream");
  }
  return fail(res, new Error("Không có API này."), 404);
}

export function startServer({ port = +(process.env.PORT || 47231), host = "127.0.0.1" } = {}) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}`);
    // chỉ phục vụ chính ứng dụng: chặn trang web lạ gọi vào máy chủ cục bộ
    const origin = req.headers.origin;
    if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) return fail(res, new Error("Origin không được phép."), 403);
    try { await route(req, res, url); } catch (e) { fail(res, e, 500); }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const addr = `http://${host}:${server.address().port}`;
      console.log(`MEDSLIDE_LISTENING=${addr}`);
      resolve({ server, url: addr });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().catch((e) => {
    if (e.code === "EADDRINUSE") startServer({ port: 0 });
    else { console.error(e); process.exit(1); }
  });
}
