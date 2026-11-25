/* MedSlide VI Studio — giao diện. Quy trình 8 bước gộp từ grand-rounds (hỏi → kế hoạch → bằng chứng → dựng → kiểm),
   frontend-slides (chọn phong cách bằng xem trước) và 2anh-studio (hỏi một lượt, tiếng Việt, PPTX sửa được). */
(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const D = window.DESKTOP || null;
const S = { meta: null, cfg: null, engines: [], projects: [], p: null, tab: "home", slide: null, search: null };

const LAYOUTS = { "title": "Tiêu đề", "section": "Chuyển chương", "bullets": "Gạch đầu dòng", "two-col": "Hai cột", "big-numbers": "Con số lớn", "table": "Bảng", "bar-chart": "Biểu đồ cột", "timeline": "Dòng thời gian", "flow": "Lưu đồ / CONSORT", "decision": "Cây quyết định", "trial-schema": "Sơ đồ thử nghiệm", "recommendations": "Khuyến cáo", "quiz": "Câu hỏi nhanh", "statement": "Thông điệp", "references": "Tài liệu tham khảo", "image": "Hình ảnh" };
const STEPS = [["brief", "Đề bài"], ["questions", "Phỏng vấn"], ["evidence", "Bằng chứng"], ["plan", "Dàn ý"], ["style", "Phong cách"], ["slides", "Slide"], ["audit", "Kiểm định"], ["export", "Xuất file"]];

// ---------- tiện ích ----------
async function api(path, body, method) {
  const r = await fetch(path, { method: method || (body ? "POST" : "GET"), headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}
function toast(msg, err = false) { const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : ""); t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => (t.hidden = true), err ? 9000 : 3500); }
function busy(on, title = "", sub = "") { $("#busy").hidden = !on; if (on) { $("#busyT").textContent = title; $("#busyP").textContent = sub; } }
async function runTask(path, body, title) {
  const t = await api(path, body || {});
  const t0 = Date.now();
  busy(true, title || t.label, "");
  try {
    for (;;) {
      await new Promise((r) => setTimeout(r, 1200));
      const s = await api(`/api/tasks/${t.id}`);
      $("#busyP").textContent = s.progress?.label || "";
      $("#busyS").textContent = `${Math.round((Date.now() - t0) / 1000)} giây · AI CLI có thể mất 1–5 phút`;
      if (s.status === "done") return s.result;
      if (s.status === "error") throw new Error(s.error);
      if (s.status === "missing") throw new Error("Mất tác vụ (máy chủ khởi động lại?)");
    }
  } finally { busy(false); }
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { busy(false); toast(e.message, true); } };
function modal(html) { $("#mbody").innerHTML = html; $("#modal").hidden = false; }
function closeModal() { $("#modal").hidden = true; clearInterval(S.jobTimer); }
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal" || e.target.closest("[data-close]")) closeModal(); });
document.addEventListener("click", (e) => { const a = e.target.closest("[data-ext]"); if (a) { e.preventDefault(); D ? D.openExternal(a.dataset.ext) : window.open(a.dataset.ext); } });

// ---------- khung ----------
async function init() {
  S.meta = await api("/api/meta");
  $("#ver").textContent = S.meta.version;
  S.cfg = await api("/api/config");
  await refreshProjects();
  render();
  refreshEngines();
}
async function refreshProjects() { S.projects = await api("/api/projects"); renderSide(); }
async function refreshEngines() {
  S.engines = await api("/api/engines").catch(() => []);
  const e = S.engines.find((x) => x.id === S.cfg.engine);
  const okk = e && e.installed && e.loggedIn;
  $("#aiChip").classList.toggle("ok", !!okk);
  $("#aiChipT").textContent = e ? `${e.name}${okk ? "" : " (chưa sẵn sàng)"}` : "Chưa kết nối AI";
}
function renderSide() {
  $("#projList").innerHTML = S.projects.length ? S.projects.map((p) => `<div class="proj ${S.p?.id === p.id ? "on" : ""}" data-id="${p.id}">${esc(p.title)}<small>${p.slides ? p.slides + " slide · " : ""}${new Date(p.updatedAt).toLocaleDateString("vi-VN")}</small></div>`).join("") : `<div class="muted small" style="padding:6px 10px">Chưa có dự án</div>`;
}
$("#projList").addEventListener("click", guard(async (e) => { const el = e.target.closest(".proj"); if (!el) return; await openProject(el.dataset.id); }));
$("#newBtn").onclick = () => { S.p = null; S.tab = "brief"; renderSide(); render(); };
$("#sampleBtn").onclick = guard(async () => { const p = await api("/api/projects", { sample: true }); await refreshProjects(); await openProject(p.id, "slides"); });
$("#aiChip").onclick = () => openAiSettings();

async function openProject(id, tab) {
  S.p = await api(`/api/projects/${id}`);
  S.slide = S.p.deck?.slides?.[0]?.id || null;
  S.tab = tab || ({ brief: "brief", questions: "questions", plan: "plan", deck: "slides", audit: "audit" }[S.p.stage] || "brief");
  renderSide(); render();
}
async function save(patch) { S.p = await api(`/api/projects/${S.p.id}`, patch); return S.p; }

function stepDone(k) {
  const p = S.p; if (!p) return false;
  return { brief: true, questions: Object.keys(p.answers || {}).length > 0, evidence: (p.evidence || []).length + (p.sources || []).length > 0, plan: !!p.plan?.approved, style: !!p.brief?.theme, slides: !!p.deck, audit: !!p.audit && p.audit.result === "PASS", export: false }[k];
}
function render() {
  $("#ptitle").textContent = S.p ? S.p.brief?.topic || S.p.id : "MedSlide VI Studio — slide Y khoa có bằng chứng";
  $("#steps").innerHTML = S.p ? STEPS.map(([k, n], i) => `<button data-k="${k}" class="${S.tab === k ? "on" : ""} ${stepDone(k) ? "done" : ""}" ${(k === "slides" || k === "audit" || k === "export") && !S.p.deck ? "disabled" : ""}><span class="n">${i + 1}</span>${n}</button>`).join("") : "";
  const v = $("#view");
  const views = { home: vHome, brief: vBrief, questions: vQuestions, evidence: vEvidence, plan: vPlan, style: vStyle, slides: vSlides, audit: vAudit, export: vExport };
  (views[S.tab] || vHome)(v);
}
$("#steps").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || b.disabled) return; S.tab = b.dataset.k; render(); });

// ---------- Trang chào ----------
function vHome(v) {
  v.innerHTML = `<div class="wrap"><div class="card hero"><div><h1>Slide Y khoa có bằng chứng, không cần cài skill hay plugin</h1>
  <p>Nhập chủ đề, AI phỏng vấn bạn một lượt, tra PubMed thật, lập dàn ý với tiêu đề khẳng định, dựng slide kèm sổ cái số liệu, rồi tự kiểm định: số không có nguồn, chữ "slop", lộ thông tin người bệnh, PMID sai. Xuất PowerPoint sửa được, PDF và HTML trình chiếu có bút laser.</p>
  <div class="row"><button class="btn primary" id="hNew">Bắt đầu bài mới</button><button class="btn" id="hSample">Xem bài mẫu DAPA-HF</button><button class="btn" id="hAi">Kết nối AI</button></div></div>
  <div><div class="flowline"><div><b>1 · Hỏi trước</b>Loại bài, khán giả, thời lượng, thông điệp</div><div><b>2 · Bằng chứng</b>PubMed, PDF của bạn, trích nguyên văn</div><div><b>3 · Dựng</b>16 bố cục y khoa, 5 phong cách</div><div><b>4 · Kiểm</b>Số liệu, PMID, PHI, slop</div></div>
  <p class="small muted" style="margin-top:14px">Chạy bằng tài khoản AI bạn đã có: Claude Code, Codex (ChatGPT), Gemini CLI, Antigravity, Ollama offline, hoặc khóa API Gemini/OpenRouter. Dữ liệu dự án nằm trên máy bạn.</p></div></div>
  <div class="card"><h3>Gộp từ ba dự án mã nguồn mở (MIT)</h3><p class="sub">Grand Rounds của BS. Trần Quang Hưng (phương pháp làm slide y khoa có kiểm chứng) · 2Anh Studio của Lương Hải Anh (quy tắc tiếng Việt, PowerPoint sửa được) · Frontend Slides của Zara Zhang (phong cách trình chiếu). Lõi kết nối AI CLI kế thừa PDF Layout VI Studio.</p></div></div>`;
  $("#hNew").onclick = () => { S.tab = "brief"; render(); };
  $("#hSample").onclick = () => $("#sampleBtn").click();
  $("#hAi").onclick = openAiSettings;
}

// ---------- 1. Đề bài ----------
function vBrief(v) {
  const b = S.p?.brief || { lang: "vi", minutes: 15, deckType: "grand-rounds", presenter: S.cfg.presenter?.name || "", affiliation: S.cfg.presenter?.affiliation || "" };
  const opt = (o, val) => Object.entries(o).map(([k, n]) => `<option value="${k}" ${k === val ? "selected" : ""}>${esc(n)}</option>`).join("");
  v.innerHTML = `<div class="wrap"><div class="card"><h3>Đề bài</h3><p class="sub">Càng rõ, AI càng ít hỏi lại. Số liệu không lấy từ trí nhớ AI: hãy đưa tài liệu hoặc tra PubMed ở bước 3.</p>
  <div class="grid">
   <div class="f c12"><label>Chủ đề bài trình bày *</label><input type="text" id="b_topic" value="${esc(b.topic || "")}" placeholder="VD: Cập nhật điều trị suy tim phân suất tống máu giảm theo ESC 2023"></div>
   <div class="f c4"><label>Loại bài</label><select id="b_deckType">${opt(S.meta.deckTypes, b.deckType)}</select></div>
   <div class="f c4"><label>Khán giả</label><input type="text" id="b_audience" value="${esc(b.audience || "")}" placeholder="BS nội trú, điều dưỡng, sinh viên Y4…"></div>
   <div class="f c2"><label>Thời lượng (phút)</label><input type="number" id="b_minutes" min="3" max="120" value="${esc(b.minutes || 15)}"></div>
   <div class="f c2"><label>Ngôn ngữ slide</label><select id="b_lang"><option value="vi" ${b.lang !== "en" ? "selected" : ""}>Tiếng Việt</option><option value="en" ${b.lang === "en" ? "selected" : ""}>English</option></select></div>
   <div class="f c4"><label>Người trình bày (in đúng trên slide)</label><input type="text" id="b_presenter" value="${esc(b.presenter || "")}" placeholder="ThS.BS. Nguyễn Văn A"></div>
   <div class="f c4"><label>Đơn vị</label><input type="text" id="b_affiliation" value="${esc(b.affiliation || "")}" placeholder="Khoa Nội tim mạch, Bệnh viện …"></div>
   <div class="f c4"><label>Sự kiện, ngày</label><input type="text" id="b_event" value="${esc(b.event || "")}" placeholder="Sinh hoạt khoa học tháng 12/2026"></div>
   <div class="f c6"><label>Thông điệp / mục tiêu bạn muốn khán giả mang về</label><textarea id="b_goal" placeholder="VD: Khởi trị sớm 4 nhóm thuốc nền tảng ngay trong lúc nằm viện">${esc(b.goal || "")}</textarea></div>
   <div class="f c6"><label>Yêu cầu thêm</label><textarea id="b_extra" placeholder="VD: có 1 ca lâm sàng tại khoa; nhấn mạnh liều khởi đầu; 3 câu hỏi trắc nghiệm cuối bài">${esc(b.extra || "")}</textarea></div>
  </div></div>
  ${S.p ? srcCard() : ""}
  <div class="row end"><button class="btn" id="bSave">${S.p ? "Lưu" : "Tạo dự án"}</button><button class="btn primary" id="bNext">${S.p ? "Lưu & để AI phỏng vấn →" : "Tạo & để AI phỏng vấn →"}</button></div></div>`;
  const collect = () => Object.fromEntries(["topic", "deckType", "audience", "minutes", "lang", "presenter", "affiliation", "event", "goal", "extra"].map((k) => [k, $("#b_" + k).value]));
  const doSave = async () => {
    const brief = collect();
    if (!brief.topic.trim()) throw new Error("Nhập chủ đề trước đã.");
    if (!S.p) { S.p = await api("/api/projects", { brief }); await refreshProjects(); }
    else await save({ brief });
    api("/api/config", { presenter: { name: brief.presenter, affiliation: brief.affiliation } }).then((c) => (S.cfg = c)).catch(() => {});
  };
  $("#bSave").onclick = guard(async () => { await doSave(); toast("Đã lưu."); render(); renderSide(); });
  $("#bNext").onclick = guard(async () => {
    await doSave(); renderSide();
    if (!(await ensureAi())) return;
    S.p = (await runTask(`/api/projects/${S.p.id}/grill`, {}, "AI đang đọc đề bài và soạn câu hỏi")).project;
    S.tab = "questions"; render();
  });
  if (S.p) bindSrc();
}
function srcCard() {
  const src = S.p.sources || [];
  return `<div class="card"><h3>Tài liệu nguồn của bạn</h3><p class="sub">Bài báo PDF, khuyến cáo, ghi chép ca bệnh đã ẩn danh. AI chỉ được lấy số liệu từ đây và từ PubMed.</p>
  <div class="drop" id="drop">Kéo thả PDF / DOCX / TXT vào đây, hoặc <b>bấm để chọn file</b><input type="file" id="fileIn" multiple accept=".pdf,.docx,.txt,.md" hidden></div>
  <details style="margin-top:10px"><summary class="small">Hoặc dán văn bản</summary><div class="grid" style="margin-top:8px"><div class="f c4"><input type="text" id="pasteName" placeholder="Tên nguồn (VD: Phác đồ BV 2025)"></div><div class="f c8"><input type="text" id="pasteCite" placeholder="Cách ghi nguồn trên slide (tùy chọn)"></div><div class="f c12"><textarea id="pasteTxt" rows="5"></textarea></div><div class="c12 row end"><button class="btn sm" id="pasteBtn">Thêm văn bản</button></div></div></details>
  <div class="srcs">${src.map((s) => `<div class="src"><span class="pill">${esc(s.id)}</span><div class="sp"><b>${esc(s.name)}</b> <span class="muted small">${s.pages ? s.pages + " trang · " : ""}${(s.chars / 1000).toFixed(1)}k ký tự</span></div><button class="btn sm danger" data-rmsrc="${esc(s.id)}">Xóa</button></div>`).join("")}</div></div>`;
}
function bindSrc() {
  const up = guard(async (files) => {
    busy(true, "Đang đọc tài liệu…");
    try { S.p = await api(`/api/projects/${S.p.id}/sources`, { files }); } finally { busy(false); }
    toast(`Đã thêm ${files.length} tài liệu.`); render();
  });
  const readFiles = (list) => Promise.all([...list].map((f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok({ name: f.name, base64: String(r.result).split(",")[1] }); r.readAsDataURL(f); })));
  const drop = $("#drop");
  drop.onclick = guard(async () => { if (D) { const fs = await D.pick("doc"); if (fs.length) up(fs); } else $("#fileIn").click(); });
  $("#fileIn").onchange = async (e) => up(await readFiles(e.target.files));
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = async (e) => { e.preventDefault(); drop.classList.remove("over"); up(await readFiles(e.dataTransfer.files)); };
  $("#pasteBtn").onclick = guard(async () => { const t = $("#pasteTxt").value.trim(); if (!t) return; S.p = await api(`/api/projects/${S.p.id}/sources`, { paste: t, pasteName: $("#pasteName").value || "Văn bản dán", citation: $("#pasteCite").value }); render(); });
  $$("[data-rmsrc]").forEach((b) => (b.onclick = guard(async () => { await save({ removeSource: b.dataset.rmsrc }); render(); })));
}

// ---------- 2. Phỏng vấn ----------
function vQuestions(v) {
  const qs = S.p.questions || [];
  const ans = S.p.answers || {};
  v.innerHTML = `<div class="wrap"><div class="card"><h3>AI hỏi bạn một lượt trước khi làm</h3><p class="sub">Mỗi câu có lựa chọn AI khuyến nghị (đã chọn sẵn). Đổi nếu cần, hoặc gõ câu trả lời riêng. Đây là "cổng" của Grand Rounds: không đoán thay bạn.</p>
  ${qs.length ? qs.map((q) => { const a = ans[q.id] ?? q.recommended ?? ""; return `<div class="q" data-q="${esc(q.id)}"><div class="qq">${esc(q.q)}</div><div class="chips">${q.options.map((o) => `<button class="chip ${o === a ? "on" : ""}" data-o="${esc(o)}">${esc(o)}${o === q.recommended ? `<span class="rec">· khuyến nghị</span>` : ""}</button>`).join("")}</div><input type="text" class="qa" value="${esc(q.options.includes(a) ? "" : a)}" placeholder="Hoặc trả lời theo ý bạn…">${q.why ? `<div class="small muted" style="margin-top:6px">Vì sao khuyến nghị: ${esc(q.why)}</div>` : ""}</div>`; }).join("") : `<div class="empty">Chưa có câu hỏi. <button class="btn" id="qGen">Để AI phỏng vấn</button></div>`}
  ${S.p.brief?.coreMessageDraft ? `<div class="f" style="margin-top:8px"><label>Thông điệp cốt lõi (AI nháp, sửa nếu cần)</label><input type="text" id="coreMsg" value="${esc(S.p.brief.goal || S.p.brief.coreMessageDraft)}"></div>` : ""}
  </div><div class="row end"><button class="btn" id="qRe">Hỏi lại</button><button class="btn primary" id="qNext">Lưu trả lời → Bằng chứng</button></div></div>`;
  $$(".q").forEach((el) => el.addEventListener("click", (e) => { const c = e.target.closest(".chip"); if (!c) return; $$(".chip", el).forEach((x) => x.classList.toggle("on", x === c)); $(".qa", el).value = ""; }));
  const collect = () => Object.fromEntries($$(".q").map((el) => [el.dataset.q, $(".qa", el).value.trim() || $(".chip.on", el)?.dataset.o || ""]));
  const regen = guard(async () => { if (!(await ensureAi())) return; S.p = (await runTask(`/api/projects/${S.p.id}/grill`, {}, "AI đang soạn câu hỏi")).project; render(); });
  $("#qRe").onclick = regen; if ($("#qGen")) $("#qGen").onclick = regen;
  $("#qNext").onclick = guard(async () => { const patch = { answers: collect() }; if ($("#coreMsg")) patch.brief = { goal: $("#coreMsg").value }; await save(patch); S.tab = "evidence"; render(); });
}

// ---------- 3. Bằng chứng ----------
function vEvidence(v) {
  const ev = S.p.evidence || [];
  const res = S.search;
  v.innerHTML = `<div class="wrap"><div class="card"><h3>Tra PubMed</h3><p class="sub">Kết quả lấy trực tiếp từ NCBI E-utilities, nên PMID/DOI là thật. Bài có PMCID có thể lấy toàn văn từ Europe PMC để AI trích số chính xác hơn abstract.</p>
   <div class="grid"><div class="f c8"><input type="text" id="pmQ" value="${esc(res?.q ?? S.p.brief?.pubmedQuery ?? "")}" placeholder="VD: dapagliflozin heart failure randomized controlled trial"></div>
   <div class="f c2"><input type="text" id="pmY" value="${esc(res?.y ?? "")}" placeholder="Từ năm (2019)"></div><div class="c2"><button class="btn primary block" id="pmGo">Tìm</button></div></div>
   ${res ? `<div class="row" style="margin:12px 0 6px"><b>${res.count.toLocaleString("vi-VN")} kết quả</b><span class="muted small">hiển thị ${res.items.length}</span><span class="sp"></span><label class="small"><input type="checkbox" id="pmFull" checked> lấy toàn văn nếu có</label><button class="btn sm primary" id="pmAdd">Thêm bài đã chọn</button></div>
   ${res.items.map((it) => `<div class="ev"><input type="checkbox" data-pm="${it.pmid}" ${ev.some((e) => e.pmid === it.pmid) ? "disabled checked" : ""}><div class="sp"><div class="t">${esc(it.title)}</div><div class="m">${esc((it.authors || []).slice(0, 3).join(", "))}${it.authors?.length > 3 ? " et al" : ""} · ${esc(it.journal)} ${esc(it.year)} · PMID ${esc(it.pmid)} ${it.pmcid ? '<span class="pill ok">toàn văn mở</span>' : ""} ${(it.pubtypes || []).filter((t) => /Trial|Meta|Guideline|Systematic/i.test(t)).map((t) => `<span class="pill">${esc(t)}</span>`).join(" ")}</div>${it.abstract ? `<details><summary>Abstract</summary>${esc(it.abstract)}</details>` : ""}</div></div>`).join("")}` : ""}
   <div class="row" style="margin-top:10px"><input type="text" id="pmIds" placeholder="Thêm nhanh theo PMID (cách nhau dấu phẩy) hoặc DOI" style="max-width:420px"><button class="btn sm" id="pmIdGo">Thêm</button></div>
  </div>
  <div class="card"><h3>Nguồn sẽ dùng (${ev.length + (S.p.sources || []).length})</h3><p class="sub">Bỏ chọn bài không muốn AI dùng. Tài liệu bạn tải lên ở bước Đề bài cũng nằm trong nguồn.</p>
   ${(S.p.sources || []).map((s) => `<div class="ev"><span class="pill">${esc(s.id)}</span><div class="sp"><div class="t">${esc(s.name)}</div><div class="m">Tài liệu của bạn · ${(s.chars / 1000).toFixed(1)}k ký tự</div></div></div>`).join("")}
   ${ev.map((e) => `<div class="ev"><input type="checkbox" data-sel="${esc(e.id)}" ${e.selected !== false ? "checked" : ""}><div class="sp"><div class="t"><span class="pill">${esc(e.id)}</span> ${esc(e.title)}</div><div class="m">${esc((e.authors || [])[0] || "")} et al · ${esc(e.journal)} ${esc(e.year)} · PMID ${esc(e.pmid || "-")} · ${e.fulltext ? '<span class="pill ok">toàn văn</span>' : e.abstract ? '<span class="pill warn">chỉ abstract</span>' : '<span class="pill bad">chỉ thông tin thư mục</span>'}</div></div>${e.pmcid && !e.fulltext ? `<button class="btn sm" data-ft="${esc(e.id)}">Lấy toàn văn</button>` : ""}<button class="btn sm danger" data-rm="${esc(e.id)}">Xóa</button></div>`).join("") || (S.p.sources?.length ? "" : `<div class="empty">Chưa có nguồn. Không có nguồn thì AI sẽ để ô [CẦN BỔ SUNG] thay cho mọi số liệu.</div>`)}
  </div>
  <div class="card"><h3>Thêm tài liệu của bạn</h3>${srcCard().replace(/^<div class="card"><h3>[^<]*<\/h3><p class="sub">[^<]*<\/p>/, "").replace(/<\/div>$/, "")}</div>
  <div class="row end"><button class="btn primary" id="evNext">AI lập dàn ý →</button></div></div>`;
  bindSrc();
  $("#pmGo").onclick = guard(async () => {
    const q = $("#pmQ").value.trim(), y = $("#pmY").value.trim();
    busy(true, "Đang tra PubMed…");
    try { const r = await api("/api/pubmed/search", { query: q, minYear: y, retmax: 15 }); S.search = { ...r, q, y }; } finally { busy(false); }
    render();
  });
  $("#pmQ").onkeydown = (e) => { if (e.key === "Enter") $("#pmGo").click(); };
  if ($("#pmAdd")) $("#pmAdd").onclick = guard(async () => {
    const ids = $$("[data-pm]:checked:not(:disabled)").map((x) => x.dataset.pm);
    if (!ids.length) return toast("Chọn ít nhất một bài.");
    busy(true, "Đang lấy abstract/toàn văn…");
    try { S.p = await api(`/api/projects/${S.p.id}/evidence`, { pmids: ids, fulltext: $("#pmFull").checked }); } finally { busy(false); }
    render();
  });
  $("#pmIdGo").onclick = guard(async () => {
    const raw = $("#pmIds").value.trim(); if (!raw) return;
    busy(true, "Đang tra cứu…");
    try { S.p = await api(`/api/projects/${S.p.id}/evidence`, /^10\./.test(raw) || /doi\.org/.test(raw) ? { doi: raw } : { pmids: raw.split(/[\s,;]+/), fulltext: true }); } finally { busy(false); }
    render();
  });
  $$("[data-sel]").forEach((c) => (c.onchange = guard(async () => { await save({ evidenceSelect: $$("[data-sel]:checked").map((x) => x.dataset.sel) }); })));
  $$("[data-rm]").forEach((b) => (b.onclick = guard(async () => { await save({ removeEvidence: b.dataset.rm }); render(); })));
  $$("[data-ft]").forEach((b) => (b.onclick = guard(async () => { busy(true, "Đang lấy toàn văn Europe PMC…"); try { S.p = await api(`/api/projects/${S.p.id}/fulltext`, { id: b.dataset.ft }); } finally { busy(false); } render(); })));
  $("#evNext").onclick = guard(async () => { if (!(await ensureAi())) return; S.p = (await runTask(`/api/projects/${S.p.id}/plan`, {}, "AI đang lập dàn ý")).project; S.tab = "plan"; render(); });
}

// ---------- 4. Dàn ý ----------
function vPlan(v) {
  const pl = S.p.plan;
  if (!pl) { v.innerHTML = `<div class="wrap"><div class="card empty">Chưa có dàn ý. <button class="btn primary" id="plGen">AI lập dàn ý</button></div></div>`; $("#plGen").onclick = guard(async () => { if (!(await ensureAi())) return; S.p = (await runTask(`/api/projects/${S.p.id}/plan`, {}, "AI đang lập dàn ý")).project; render(); }); return; }
  const lopt = (val) => Object.entries(LAYOUTS).map(([k, n]) => `<option value="${k}" ${k === val ? "selected" : ""}>${n}</option>`).join("");
  const total = pl.slides.reduce((a, s) => a + (+s.minutes || 0), 0);
  v.innerHTML = `<div class="wrap"><div class="card"><h3>Dàn ý — hợp đồng trước khi dựng</h3><p class="sub">Đọc liền các tiêu đề phải thành một câu chuyện. Tiêu đề là câu khẳng định kết luận, không phải "Kết quả". Duyệt xong mới dựng slide.</p>
   <div class="f"><label>Thông điệp cốt lõi</label><input type="text" id="plCore" value="${esc(pl.coreMessage)}"></div>
   ${(pl.openQuestions || []).length ? `<p class="small" style="color:var(--warn)">AI còn băn khoăn: ${esc(pl.openQuestions.join(" · "))}</p>` : ""}
   <table class="plan" style="margin-top:12px"><thead><tr><th>#</th><th style="width:150px">Bố cục</th><th>Tiêu đề khẳng định</th><th style="width:26%">Số liệu cần / hình ảnh</th><th style="width:60px">Phút</th><th></th></tr></thead><tbody>
   ${pl.slides.map((s, i) => `<tr data-i="${i}"><td class="muted">${i + 1}</td><td><select data-f="layout">${lopt(s.layout)}</select></td><td><textarea data-f="title" rows="2">${esc(s.title)}</textarea></td><td><textarea data-f="claimsNeeded" rows="2" placeholder="${esc(s.visual)}">${esc(s.claimsNeeded)}</textarea></td><td><input type="number" step="0.5" data-f="minutes" value="${esc(s.minutes)}"></td><td><button class="btn sm ghost" data-del="${i}" title="Xóa">✕</button><button class="btn sm ghost" data-ins="${i}" title="Chèn dưới">＋</button></td></tr>`).join("")}
   </tbody></table><p class="small muted">${pl.slides.length} slide · tổng ${total.toFixed(1)} phút / mục tiêu ${S.p.brief.minutes} phút</p></div>
   <div class="row end"><button class="btn" id="plRe">Lập lại dàn ý</button><button class="btn" id="plSave">Lưu</button><button class="btn primary" id="plGo">Duyệt → chọn phong cách</button></div></div>`;
  const collect = () => ({ coreMessage: $("#plCore").value, slides: $$("tr[data-i]").map((tr, i) => { const o = { ...pl.slides[+tr.dataset.i], n: i + 1 }; $$("[data-f]", tr).forEach((x) => (o[x.dataset.f] = x.dataset.f === "minutes" ? +x.value : x.value)); return o; }) });
  $$("[data-del]").forEach((b) => (b.onclick = () => { const c = collect(); c.slides.splice(+b.dataset.del, 1); S.p.plan = { ...pl, ...c }; render(); }));
  $$("[data-ins]").forEach((b) => (b.onclick = () => { const c = collect(); c.slides.splice(+b.dataset.ins + 1, 0, { layout: "bullets", title: "", claimsNeeded: "", minutes: 1 }); S.p.plan = { ...pl, ...c }; render(); }));
  $("#plSave").onclick = guard(async () => { await save({ plan: collect() }); toast("Đã lưu dàn ý."); });
  $("#plRe").onclick = guard(async () => { if (!(await ensureAi())) return; S.p = (await runTask(`/api/projects/${S.p.id}/plan`, {}, "AI đang lập lại dàn ý")).project; render(); });
  $("#plGo").onclick = guard(async () => { await save({ plan: { ...collect(), approved: true } }); S.tab = "style"; render(); });
}

// ---------- 5. Phong cách (frontend-slides: chọn bằng mắt, không bằng tên) ----------
function vStyle(v) {
  const cur = S.p.deck?.meta?.theme || S.p.brief?.theme || "lam-sang";
  v.innerHTML = `<div class="wrap"><div class="card"><h3>Chọn phong cách bằng cách nhìn</h3><p class="sub">Cùng một nội dung mẫu, năm phong cách. Font đều có sẵn trên Windows và hiển thị đủ dấu tiếng Việt; không tải gì từ Internet khi trình chiếu.</p>
  <div class="themes">${Object.entries(S.meta.themes).map(([k, t]) => `<div class="th ${k === cur ? "on" : ""}" data-t="${k}"><div class="pv"><iframe loading="lazy" src="/api/theme-preview?theme=${k}&slides=4&embed" tabindex="-1"></iframe></div><div class="nm"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></div></div>`).join("")}</div></div>
  <div class="row end">${S.p.deck ? `<button class="btn" id="stApply">Áp dụng cho slide hiện có</button>` : ""}<button class="btn primary" id="stGo">${S.p.deck ? "Dựng lại toàn bộ slide theo dàn ý" : "AI dựng slide →"}</button></div></div>`;
  let sel = cur;
  $$(".th").forEach((el) => (el.onclick = () => { sel = el.dataset.t; $$(".th").forEach((x) => x.classList.toggle("on", x === el)); }));
  if ($("#stApply")) $("#stApply").onclick = guard(async () => { await save({ brief: { theme: sel }, theme: sel }); S.tab = "slides"; render(); });
  $("#stGo").onclick = guard(async () => {
    if (!S.p.plan?.slides?.length) throw new Error("Chưa có dàn ý.");
    if (S.p.deck && !confirm("Dựng lại sẽ thay toàn bộ slide hiện tại. Tiếp tục?")) return;
    await save({ brief: { theme: sel } });
    if (!(await ensureAi())) return;
    S.p = (await runTask(`/api/projects/${S.p.id}/build`, {}, "AI đang dựng slide và ghi sổ cái số liệu")).project;
    S.slide = S.p.deck.slides[0]?.id; S.tab = "slides"; await refreshProjects(); render();
  });
}

// ---------- 6. Slide ----------
function flagsFor(id) { return (S.p.audit?.findings || []).filter((f) => f.slideId === id && f.severity === "blocking").length; }
function vSlides(v) {
  const d = S.p.deck;
  if (!S.slide || !d.slides.some((s) => s.id === S.slide)) S.slide = d.slides[0]?.id;
  const idx = d.slides.findIndex((s) => s.id === S.slide);
  const s = d.slides[idx] || {};
  const { id, title, notes, layout, refs, ...fields } = s;
  v.innerHTML = `<div class="editor">
   <div class="slist">${d.slides.map((x, i) => `<div class="si ${x.id === S.slide ? "on" : ""}" data-id="${x.id}"><span class="k">${i + 1}</span><span>${esc(x.title || "(không tiêu đề)")}<span class="lay">${LAYOUTS[x.layout] || x.layout}${flagsFor(x.id) ? ` · <span class="flag">${flagsFor(x.id)} lỗi</span>` : ""}</span></span></div>`).join("")}</div>
   <div class="stage"><div class="pvbox"><iframe id="pv" src="/api/projects/${S.p.id}/deck.html?embed&v=${Date.now()}#${idx + 1}"></iframe></div>
     <div class="row"><button class="btn sm" id="present">▶ Trình chiếu</button><span class="muted small">Phím: ←/→ chuyển · L laser · C khoanh · P bút · N ghi chú · F toàn màn hình</span></div>
     <div class="notesbox"><b>Ghi chú người trình bày</b><br>${esc(notes || "—")}</div></div>
   <div class="insp">
     <div class="f"><label>Bố cục</label><select id="eLayout">${Object.entries(LAYOUTS).map(([k, n]) => `<option value="${k}" ${k === layout ? "selected" : ""}>${n}</option>`).join("")}</select></div>
     <div class="f"><label>Tiêu đề (câu khẳng định)</label><textarea id="eTitle" rows="2">${esc(title)}</textarea></div>
     <div class="f"><label>Nội dung (JSON của bố cục)</label><textarea id="eFields" class="json">${esc(JSON.stringify(fields, null, 2))}</textarea></div>
     <div class="f"><label>Nguồn trên slide (mã, cách nhau dấu phẩy)</label><input type="text" id="eRefs" value="${esc((refs || []).join(", "))}"></div>
     <div class="f"><label>Ghi chú người trình bày</label><textarea id="eNotes" rows="4">${esc(notes)}</textarea></div>
     <div class="row"><button class="btn primary sm" id="eSave">Lưu slide</button><button class="btn sm" data-op="up">↑</button><button class="btn sm" data-op="down">↓</button><button class="btn sm" data-op="duplicate">Nhân bản</button><button class="btn sm" data-op="add">+ Slide</button><button class="btn sm danger" data-op="delete">Xóa</button></div>
     <div class="f" style="border-top:1px solid var(--line);padding-top:10px"><label>Nhờ AI sửa slide này</label><textarea id="eAsk" rows="3" placeholder="VD: đổi sang biểu đồ cột so sánh 2 nhánh; rút gọn còn 3 ý; thêm hiệu quả tuyệt đối"></textarea><button class="btn sm" id="eAskGo">AI sửa</button></div>
     ${(S.p.audit?.findings || []).filter((f) => f.slideId === S.slide).map((f) => `<div class="find ${f.severity}"><div class="h">${esc(f.code)} · ${esc(f.problem)}</div><div class="fx">${esc(f.fix)}</div></div>`).join("")}
   </div></div>`;
  $$(".si").forEach((el) => (el.onclick = () => { S.slide = el.dataset.id; render(); }));
  $("#present").onclick = () => window.open(`/api/projects/${S.p.id}/deck.html#${idx + 1}`, "_blank");
  $("#eSave").onclick = guard(async () => {
    let f; try { f = JSON.parse($("#eFields").value || "{}"); } catch (e) { throw new Error("JSON nội dung bị lỗi: " + e.message); }
    await save({ slide: { ...f, id: S.slide, layout: $("#eLayout").value, title: $("#eTitle").value, notes: $("#eNotes").value, refs: $("#eRefs").value.split(/[\s,;]+/).filter(Boolean) } });
    toast("Đã lưu slide."); render();
  });
  $$("[data-op]").forEach((b) => (b.onclick = guard(async () => {
    if (b.dataset.op === "delete" && !confirm("Xóa slide này?")) return;
    const i = idx;
    await save({ slideOp: { op: b.dataset.op, id: S.slide } });
    const sl = S.p.deck.slides;
    S.slide = (b.dataset.op === "delete" ? sl[Math.min(i, sl.length - 1)] : b.dataset.op === "add" || b.dataset.op === "duplicate" ? sl[i + 1] : sl.find((x) => x.id === S.slide))?.id;
    render();
  })));
  $("#eAskGo").onclick = guard(async () => {
    const ins = $("#eAsk").value.trim(); if (!ins) return;
    if (!(await ensureAi())) return;
    S.p = (await runTask(`/api/projects/${S.p.id}/revise`, { slideId: S.slide, instruction: ins }, "AI đang sửa slide")).project; render();
  });
}

// ---------- 7. Kiểm định ----------
function vAudit(v) {
  const a = S.p.audit, rv = S.p.review;
  const block = (list) => list.map((f) => `<div class="find ${f.severity}" data-go="${esc(f.slideId || "")}"><div class="h">${f.slide ? `Slide ${f.slide} · ` : ""}${esc(f.code)} · ${esc(f.problem)}</div><div class="fx">${esc(f.fix || "")}</div></div>`).join("");
  v.innerHTML = `<div class="wrap"><div class="card"><div class="row"><div class="sp"><h3>Kiểm định tự động</h3><p class="sub" style="margin:0">Số trên slide không có trong sổ cái nguồn · PMID/DOI đối chiếu PubMed/Crossref · thông tin nhận dạng người bệnh · 21 dấu hiệu slide do máy làm (S01–S21).</p></div><label class="small"><input type="checkbox" id="auRef" checked> Đối chiếu PubMed/Crossref</label><button class="btn primary" id="auGo">Chạy kiểm định</button></div>
  ${a ? `<div class="row" style="margin:14px 0"><span class="pill ${a.result === "PASS" ? "ok" : "bad"}" style="font-size:14px;padding:5px 14px">${a.result === "PASS" ? "ĐẠT" : "CHƯA ĐẠT"}</span><b>${a.blocking}</b> lỗi chặn · <b>${a.advisory}</b> lưu ý <span class="muted small">· ${new Date(a.at).toLocaleString("vi-VN")}</span></div>${block(a.findings) || `<div class="empty">Không phát hiện vấn đề.</div>`}` : `<div class="empty">Chưa chạy.</div>`}
  </div>
  <div class="card"><div class="row"><div class="sp"><h3>AI phản biện bằng chứng</h3><p class="sub" style="margin:0">Một lượt AI độc lập đọc slide đối chiếu nguồn: sai kết cục, sai dân số, cường điệu khi KTC chứa 1, phân nhóm trình bày như kết quả chính. Nên dùng một AI khác với AI đã dựng slide.</p></div><button class="btn" id="rvGo">AI phản biện</button></div>
  ${rv ? `<p class="small muted">${esc(rv.summary || "")} · ${esc(rv.engine || "")}</p>${block(rv.findings.map((f) => ({ ...f, slideId: S.p.deck.slides[(+f.slide || 0) - 1]?.id })))}` : ""}</div>
  <p class="small muted">Kiểm tự động không thay được người: xem lại mọi hình ảnh (mặt, tên, ngày trên phim), và đọc từng con số đối chiếu bài gốc trước khi trình bày.</p></div>`;
  $("#auGo").onclick = guard(async () => { S.p = (await runTask(`/api/projects/${S.p.id}/audit`, { verifyRefs: $("#auRef").checked }, "Đang kiểm định")).project; render(); });
  $("#rvGo").onclick = guard(async () => { if (!(await ensureAi())) return; S.p = (await runTask(`/api/projects/${S.p.id}/review`, {}, "AI đang phản biện bằng chứng")).project; render(); });
  $$("[data-go]").forEach((el) => (el.onclick = () => { if (!el.dataset.go) return; S.slide = el.dataset.go; S.tab = "slides"; render(); }));
}

// ---------- 8. Xuất ----------
function vExport(v) {
  const a = S.p.audit;
  v.innerHTML = `<div class="wrap">${!a ? `<div class="card" style="border-color:#F3C98B;background:#FFF9EF">Chưa chạy kiểm định. Nên chạy trước khi xuất để không mang số liệu chưa có nguồn lên bục.</div>` : a.result !== "PASS" ? `<div class="card" style="border-color:#F1B0B0;background:#FFF5F5">Kiểm định còn <b>${a.blocking}</b> lỗi chặn. Bạn vẫn xuất được, nhưng hãy sửa trước khi trình bày.</div>` : ""}
  <div class="exp">
   <div class="card"><div class="ic">PPTX</div><b>PowerPoint sửa được</b><span class="small muted">Chữ, bảng, biểu đồ, sơ đồ là đối tượng PowerPoint thật; có ghi chú người trình bày.</span><button class="btn primary" data-x="pptx">Xuất PPTX</button></div>
   <div class="card"><div class="ic">PDF</div><b>PDF 16:9</b><span class="small muted">Bản dự phòng, phát tay, gửi ban tổ chức. Mỗi slide một trang, hiện mọi nội dung.</span><button class="btn primary" data-x="pdf">Xuất PDF</button></div>
   <div class="card"><div class="ic">HTML</div><b>Trình chiếu một file</b><span class="small muted">Chạy offline trên mọi trình duyệt, có bút laser, khoanh, ghi chú. Hiệu ứng mượt.</span><button class="btn primary" data-x="html">Xuất HTML</button></div>
   <div class="card"><div class="ic">.json</div><b>Gói dự án</b><span class="small muted">Toàn bộ đề bài, nguồn, sổ cái số liệu, slide: để lưu trữ hoặc gửi đồng nghiệp.</span><button class="btn" data-x="json">Xuất gói</button></div>
  </div><div id="xOut" class="card" style="margin-top:16px" hidden></div></div>`;
  $$("[data-x]").forEach((b) => (b.onclick = guard(async () => {
    const fmt = b.dataset.x;
    let path = "";
    if (fmt === "pdf") {
      if (!D) { window.open(`/api/projects/${S.p.id}/deck.html?print=1`, "_blank"); return toast("Trong trình duyệt: Ctrl+P → Lưu thành PDF, bật Đồ họa nền."); }
      busy(true, "Đang xuất PDF…"); try { const r = await D.exportPdf(S.p.id, `${S.p.id}.pdf`); if (r.canceled) return; path = r.path; } finally { busy(false); }
    } else {
      busy(true, `Đang xuất ${fmt.toUpperCase()}…`);
      let r; try { r = await api(`/api/projects/${S.p.id}/export`, { format: fmt }); } finally { busy(false); }
      if (D) { const s = await D.saveAs(r.file, r.name); path = s.canceled ? r.file : s.path; }
      else { window.location.href = `/api/projects/${S.p.id}/download?name=${encodeURIComponent(r.name)}`; path = r.file; }
    }
    const o = $("#xOut"); o.hidden = false;
    o.innerHTML = `<b>Đã lưu:</b> <code>${esc(path)}</code> ${D ? `<button class="btn sm" id="xOpen">Mở file</button> <button class="btn sm" id="xDir">Mở thư mục</button>` : ""}`;
    if (D) { $("#xOpen").onclick = () => D.openPath(path); $("#xDir").onclick = () => D.showItem(path); }
  })));
}

// ---------- Kết nối AI ----------
async function ensureAi() {
  const e = S.engines.find((x) => x.id === S.cfg.engine);
  if (e && e.installed && e.loggedIn) return true;
  openAiSettings("Cần chọn một nền tảng AI đã cài và đăng nhập trước.");
  return false;
}
function openAiSettings(note = "") {
  const render2 = () => {
    const cats = { cli: "AI CLI (dùng gói tài khoản bạn đã có)", api: "Khóa API", local: "Chạy offline" };
    modal(`<h2 style="margin-top:0">Kết nối AI</h2>${note ? `<p style="color:var(--warn)">${esc(note)}</p>` : ""}<p class="muted">Studio dùng AI bạn đã có trên máy. Chọn một nền tảng chính; có thể thêm nền tảng dự phòng khi nền tảng chính lỗi.</p>
    ${Object.entries(cats).map(([c, n]) => `<h4>${n}</h4>${S.engines.filter((e) => e.category === c).map((e) => `<div class="eng ${S.cfg.engine === e.id ? "sel" : ""}"><input type="radio" name="eng" value="${e.id}" ${S.cfg.engine === e.id ? "checked" : ""}><div class="nm"><b>${esc(e.name)} ${e.installed && e.loggedIn ? '<span class="pill ok">sẵn sàng</span>' : e.installed ? '<span class="pill warn">chưa đăng nhập</span>' : '<span class="pill bad">chưa cài</span>'}</b><span>${esc(e.vendor)} · ${esc(e.detail)}</span>
      ${e.envKeyName ? `<div class="row" style="margin-top:6px"><input type="password" data-key="${e.envKeyName}" placeholder="${esc(e.envKeyLabel || e.envKeyName)}${S.cfg.apiKeys?.[e.envKeyName] ? " — đã lưu " + S.cfg.apiKeys[e.envKeyName] : ""}" style="max-width:360px"></div>` : ""}</div>
      <div class="row">${e.installCmd && !e.installed ? `<button class="btn sm" data-inst="${e.id}">Cài</button>` : ""}${e.loginCmd && e.installed && !e.loggedIn ? `<button class="btn sm" data-login="${e.id}">Đăng nhập</button>` : ""}<button class="btn sm" data-ping="${e.id}">Thử</button></div></div>`).join("")}`).join("")}
    <div class="grid" style="margin-top:12px"><div class="f c6"><label>Mô hình (để trống = mặc định của nền tảng)</label><input type="text" id="aiModel" value="${esc(S.cfg.model || "")}" list="mdl"><datalist id="mdl"></datalist></div>
    <div class="f c6"><label>Dự phòng (lần lượt khi nền tảng chính lỗi)</label><select id="aiFb" multiple size="3">${S.engines.filter((e) => e.installed).map((e) => `<option value="${e.id}" ${(S.cfg.fallback || []).includes(e.id) ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></div></div>
    <pre class="job" id="job" hidden></pre>
    <div class="row end" style="margin-top:12px"><button class="btn" id="aiRef">Kiểm tra lại</button><button class="btn primary" id="aiSave">Lưu</button></div>`);
    const fillModels = () => { const id = $("input[name=eng]:checked")?.value; const e = S.engines.find((x) => x.id === id); $("#mdl").innerHTML = (e?.models || []).map((m) => `<option value="${esc(m)}">`).join(""); };
    $$("input[name=eng]").forEach((r) => (r.onchange = fillModels)); fillModels();
    const saveCfg = async () => {
      const keys = {}; $$("[data-key]").forEach((i) => { if (i.value.trim()) keys[i.dataset.key] = i.value.trim(); });
      S.cfg = await api("/api/config", { engine: $("input[name=eng]:checked")?.value || "", model: $("#aiModel").value, fallback: $$("#aiFb option:checked").map((o) => o.value), apiKeys: keys });
    };
    $("#aiSave").onclick = guard(async () => { await saveCfg(); await refreshEngines(); closeModal(); toast("Đã lưu kết nối AI."); });
    $("#aiRef").onclick = guard(async () => { await saveCfg(); busy(true, "Đang dò các AI trên máy…"); try { await refreshEngines(); } finally { busy(false); } render2(); });
    $$("[data-ping]").forEach((b) => (b.onclick = guard(async () => { await saveCfg(); busy(true, "Đang gửi câu thử…"); try { const r = await api("/api/engines/ping", { id: b.dataset.ping, model: b.dataset.ping === S.cfg.engine ? S.cfg.model : "" }); toast(`Trả lời sau ${(r.latencyMs / 1000).toFixed(1)} giây: ${String(r.reply).slice(0, 80)}`); } finally { busy(false); } })));
    const follow = (job) => {
      const pre = $("#job"); pre.hidden = false; clearInterval(S.jobTimer);
      if (!job.id) { pre.textContent = job.launched ? "Đã mở cửa sổ dòng lệnh. Làm theo hướng dẫn trong đó rồi bấm Kiểm tra lại." : job.command || ""; return; }
      S.jobTimer = setInterval(async () => { const j = await api(`/api/jobs/${job.id}`); pre.textContent = j.output || "…"; pre.scrollTop = 1e9; if (j.status !== "running") { clearInterval(S.jobTimer); pre.textContent += `\n[${j.status}] — bấm Kiểm tra lại.`; } }, 1200);
    };
    $$("[data-inst]").forEach((b) => (b.onclick = guard(async () => follow(await api("/api/engines/install", { id: b.dataset.inst })))));
    $$("[data-login]").forEach((b) => (b.onclick = guard(async () => follow(await api("/api/engines/login", { id: b.dataset.login, mode: "terminal" })))));
  };
  render2();
}

init().catch((e) => toast(e.message, true));
})();
