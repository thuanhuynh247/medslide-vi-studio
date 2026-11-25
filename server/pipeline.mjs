// pipeline.mjs — Điều phối các bước AI: phỏng vấn → dàn ý → dựng slide (theo lô) → sửa slide → phản biện
import { runAi } from "./drivers.mjs";
import { getConfig, logStep } from "./store.mjs";
import { grillPrompt, planPrompt, buildPrompt, revisePrompt, reviewPrompt } from "./prompts.mjs";
import { sourcesForPrompt } from "./sources.mjs";

// Lấy JSON từ câu trả lời của CLI (có thể kèm ```json, lời dẫn, dấu phẩy thừa)
export function parseJsonLoose(raw) {
  let s = String(raw || "").trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence && fence[1].includes("{")) s = fence[1];
  const start = s.indexOf("{");
  if (start < 0) throw new Error("AI không trả về JSON. Trích đoạn: " + String(raw).slice(0, 200));
  // tìm dấu } khép đúng cặp, bỏ qua chuỗi
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  let body = end > 0 ? s.slice(start, end + 1) : s.slice(start);
  const attempts = [
    (x) => x,
    (x) => x.replace(/,\s*([}\]])/g, "$1"),
    (x) => x.replace(/,\s*([}\]])/g, "$1").replace(/[“”]/g, '"').replace(/\t/g, " "),
    (x) => closeTruncated(x.replace(/,\s*([}\]])/g, "$1")),
  ];
  let lastErr;
  for (const f of attempts) {
    try { return JSON.parse(f(body)); } catch (e) { lastErr = e; }
  }
  throw new Error("JSON từ AI bị lỗi: " + lastErr.message);
}

// Câu trả lời bị cắt giữa chừng: đóng các ngoặc còn mở
function closeTruncated(x) {
  const stack = [];
  let inStr = false, esc = false;
  for (const c of x) {
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === "{" || c === "[") stack.push(c); else if (c === "}" || c === "]") stack.pop();
  }
  let y = x;
  if (inStr) y += '"';
  y = y.replace(/,\s*$/, "").replace(/,\s*"[^"]*"?\s*:?\s*$/, "");
  while (stack.length) y += stack.pop() === "{" ? "}" : "]";
  return y;
}

async function ask(prompt, opts = {}) {
  const cfg = getConfig();
  const engine = opts.engine || cfg.engine;
  const model = opts.model ?? cfg.model;
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = attempt ? prompt + "\n\nLẦN TRƯỚC JSON BỊ LỖI. Lần này chỉ trả về JSON hợp lệ, ngắn gọn hơn." : prompt;
    const { text, engine: used } = await runAi(p, { engine, model, fallback: cfg.fallback || [] });
    try {
      return { data: parseJsonLoose(text), engine: used };
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function digest(p) {
  return sourcesForPrompt(p.sources, p.evidence, 8000);
}

export async function runGrill(p) {
  const { data, engine } = await ask(grillPrompt(p, digest(p)));
  p.questions = (data.questions || []).slice(0, 6).map((q, i) => ({
    id: q.id || `q${i + 1}`, q: String(q.q || ""), options: (q.options || []).map(String).slice(0, 4),
    recommended: q.recommended || "", why: q.why || "",
  })).filter((q) => q.q);
  if (data.pubmedQuery && !p.brief.pubmedQuery) p.brief.pubmedQuery = data.pubmedQuery;
  if (data.coreMessageDraft) p.brief.coreMessageDraft = data.coreMessageDraft;
  p.stage = "questions";
  logStep(p, `Phỏng vấn: ${p.questions.length} câu (${engine})`);
  return p;
}

export async function runPlan(p) {
  const { data, engine } = await ask(planPrompt(p, sourcesForPrompt(p.sources, p.evidence)));
  const slides = (data.slides || []).map((s, i) => ({
    n: i + 1, layout: s.layout || "bullets", title: String(s.title || ""), visual: s.visual || "",
    claimsNeeded: s.claimsNeeded || "", notes: s.notes || "", minutes: +s.minutes || 1,
  }));
  if (!slides.length) throw new Error("AI không trả về dàn ý.");
  p.plan = { coreMessage: data.coreMessage || "", slides, openQuestions: data.openQuestions || [], approved: false, engine };
  p.stage = "plan";
  logStep(p, `Dàn ý: ${slides.length} slide (${engine})`);
  return p;
}

const BATCH = 6;

export async function runBuild(p, onProgress = () => {}) {
  if (!p.plan?.slides?.length) throw new Error("Chưa có dàn ý.");
  const src = sourcesForPrompt(p.sources, p.evidence);
  const plan = p.plan.slides;
  const work = plan.filter((s) => s.layout !== "references");
  const built = new Map();
  const claims = [];
  for (let i = 0; i < work.length; i += BATCH) {
    const chunk = work.slice(i, i + BATCH);
    onProgress({ done: i, total: work.length, label: `Đang dựng slide ${chunk[0].n}–${chunk[chunk.length - 1].n}` });
    const { data } = await ask(buildPrompt(p, src, chunk, plan));
    const outSlides = data.slides || [];
    chunk.forEach((ps, k) => {
      const s = outSlides.find((x) => +x.n === ps.n) || outSlides[k];
      built.set(ps.n, normalizeSlide(s ? { ...s } : { layout: ps.layout, title: ps.title, points: ["[CẦN BỔ SUNG: nội dung]"] }, ps));
    });
    for (const c of data.claims || []) claims.push(normalizeClaim(c));
  }
  const slides = plan.map((ps) => ps.layout === "references" ? { layout: "references", title: ps.title || "Tài liệu tham khảo" } : built.get(ps.n));
  if ((p.evidence?.some((e) => e.selected !== false) || p.sources?.length) && !slides.some((s) => s.layout === "references")) {
    slides.push({ layout: "references", title: p.brief?.lang === "en" ? "References" : "Tài liệu tham khảo" });
  }
  slides.forEach((s, i) => { s.id = s.id || `s${i + 1}-${Math.random().toString(36).slice(2, 7)}`; });
  // gắn claims vào slide id
  for (const c of claims) { const s = slides[(+c.slide || 0) - 1]; if (s) c.slideId = s.id; }
  p.deck = {
    meta: {
      title: slides[0]?.title || p.brief.topic, lang: p.brief.lang || "vi", theme: p.brief.theme || "lam-sang",
      deckType: p.brief.deckType, presenter: p.brief.presenter || "", affiliation: p.brief.affiliation || "", event: p.brief.event || "",
    },
    slides, claims,
  };
  p.stage = "deck";
  p.audit = null;
  logStep(p, `Dựng ${slides.length} slide, ${claims.length} số liệu có nguồn`);
  onProgress({ done: work.length, total: work.length, label: "Xong" });
  return p;
}

export async function runRevise(p, slideId, instruction) {
  const idx = p.deck.slides.findIndex((s) => s.id === slideId);
  if (idx < 0) throw new Error("Không tìm thấy slide.");
  const old = p.deck.slides[idx];
  const { data } = await ask(revisePrompt(p, stripId(old), instruction, sourcesForPrompt(p.sources, p.evidence, 40000)));
  const ns = normalizeSlide({ ...(data.slide || data), id: old.id }, { layout: old.layout, title: old.title });
  p.deck.slides[idx] = ns;
  const newClaims = (data.claims || []).map(normalizeClaim).map((c) => ({ ...c, slide: idx + 1, slideId: old.id }));
  if (newClaims.length) p.deck.claims = [...(p.deck.claims || []).filter((c) => c.slideId !== old.id), ...newClaims];
  logStep(p, `Sửa slide ${idx + 1}: ${instruction.slice(0, 60)}`);
  return p;
}

export async function runReview(p) {
  const { data, engine } = await ask(reviewPrompt(p, p.deck, sourcesForPrompt(p.sources, p.evidence, 70000)));
  return { findings: (data.findings || []).slice(0, 60), summary: data.summary || "", engine };
}

function stripId(s) { const { id, ...rest } = s; return rest; }

const LAYOUTS = new Set(["title", "section", "bullets", "two-col", "big-numbers", "table", "bar-chart", "timeline", "flow", "decision", "trial-schema", "recommendations", "quiz", "statement", "references", "image"]);

export function normalizeSlide(s, plan = {}) {
  const out = { ...s };
  delete out.n;
  if (!LAYOUTS.has(out.layout)) out.layout = LAYOUTS.has(plan.layout) ? plan.layout : "bullets";
  out.title = String(out.title || plan.title || "");
  out.notes = String(out.notes || plan.notes || "");
  out.refs = Array.isArray(out.refs) ? out.refs.map((r) => String(r).replace(/[[\]]/g, "")) : [];
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  if (["bullets", "statement"].includes(out.layout)) out.points = arr(out.points).map(String);
  if (out.layout === "bar-chart") {
    out.categories = arr(out.categories).map(String);
    out.series = arr(out.series).map((se) => ({ name: String(se.name || ""), role: se.role || "neutral", values: arr(se.values).map((v) => parseFloat(String(v).replace(",", "."))).map((v) => (Number.isFinite(v) ? v : 0)) }));
  }
  if (out.layout === "table") { out.columns = arr(out.columns).map(String); out.rows = arr(out.rows).map((r) => arr(r).map((c) => String(c ?? ""))); }
  if (out.layout === "quiz") { out.options = arr(out.options).map(String); out.answer = Math.max(0, Math.min(out.options.length - 1, +out.answer || 0)); }
  return out;
}

function normalizeClaim(c) {
  return {
    slide: +c.slide || 0, text: String(c.text || ""), values: (Array.isArray(c.values) ? c.values : [c.values]).filter(Boolean).map(String),
    source: String(c.source || "").replace(/[[\]]/g, ""), locator: String(c.locator || ""), quote: String(c.quote || ""),
    kind: c.kind || "observed", status: c.status || "unverified",
  };
}
