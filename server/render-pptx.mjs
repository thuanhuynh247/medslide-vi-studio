// render-pptx.mjs — Xuất PowerPoint SỬA ĐƯỢC (tinh thần 2anh-studio / PPT Master: chữ, hình, biểu đồ là
// đối tượng PowerPoint thật, không phải ảnh dán). Biểu đồ là chart gốc, sơ đồ là shape gốc, notes đầy đủ.
import PptxGenJS from "pptxgenjs";
import { theme } from "./themes.mjs";
import { referenceContext } from "./render-html.mjs";
import { formatVancouver } from "./evidence.mjs";

const X = (px) => px / 144; // 1920 px ↔ 13,333 in
const PT = (px) => Math.round(px * 0.5); // 1920 px ↔ 960 pt
const hex = (c) => String(c || "#000000").replace("#", "").toUpperCase();
const clean = (s) => String(s ?? "").replace(/\*\*(.+?)\*\*/g, "$1");

export async function renderDeckPptx(deck, project) {
  const t = theme(deck.meta?.theme);
  const lang = deck.meta?.lang || "vi";
  const ctx = referenceContext(deck, project);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = deck.meta?.presenter || "MedSlide VI Studio";
  pptx.company = deck.meta?.affiliation || "";
  pptx.title = deck.meta?.title || "Bài trình bày";
  pptx.theme = { headFontFace: t.pptHead, bodyFontFace: t.pptFont, lang: lang === "en" ? "en-US" : "vi-VN" };
  const L = 96, R = 96, W = 1920 - L - R;
  const big = t.large ? 1.1 : 1;
  const F = t.pptFont, FH = t.pptHead;
  const C = { bg: hex(t.bg), ink: hex(t.ink), ink2: hex(t.ink2), muted: hex(t.muted), line: hex(t.line), p: hex(t.primary), pl: hex(t.primaryL), acc: hex(t.accent), int: hex(t.int), intl: hex(t.intL), ctl: hex(t.ctl), ctll: hex(t.ctlL) };
  const roleColor = (r, i = 0) => (r === "int" ? C.int : r === "ctl" ? C.ctl : [C.p, C.acc, C.muted, C.ink2][i % 4]);
  const need = (s) => /\[(CẦN BỔ SUNG|NEED)/.test(String(s || ""));
  const run = (s, o = {}) => ({ text: clean(s), options: need(s) ? { ...o, highlight: "FFE58A", color: "5A3B00" } : o });

  const total = deck.slides.length;
  deck.slides.forEach((s, i) => {
    const sl = pptx.addSlide();
    sl.background = { color: s.layout === "section" ? C.p : C.bg };
    if (s.notes) sl.addNotes(clean(s.notes));
    const cite = (s.refs || []).map((id) => ctx.shortCite(id)).filter(Boolean).join("; ");
    const footer = () => {
      if (["title", "section"].includes(s.layout)) return;
      if (cite || (t.band && deck.meta?.affiliation)) sl.addText(cite ? (lang === "en" ? "Source: " : "Nguồn: ") + cite : deck.meta.affiliation, { x: X(L), y: X(1080 - 70), w: X(1500), h: X(40), fontFace: F, fontSize: 9, italic: Boolean(cite), color: C.muted, margin: 0 });
      sl.addText(`${i + 1} / ${total}`, { x: X(1920 - R - 200), y: X(1080 - 70), w: X(200), h: X(40), fontFace: F, fontSize: 9, color: C.muted, align: "right", margin: 0 });
    };
    const titleBox = () => {
      if (t.band) {
        sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: X(1920), h: X(190), fill: { color: C.p }, line: { color: C.p } });
        sl.addText(clean(s.title), { x: X(L), y: 0, w: X(W), h: X(190), fontFace: FH, fontSize: PT(50), bold: true, color: "FFFFFF", valign: "middle", margin: 0, fit: "shrink" });
      } else {
        sl.addText(clean(s.title), { x: X(L), y: X(56), w: X(W), h: X(150), fontFace: FH, fontSize: PT(54 * big), bold: true, color: C.ink, valign: "top", margin: 0, fit: "shrink" });
      }
    };
    const top = X(236), bodyH = X(1080 - 236 - 110);
    const bullets = (pts, x, y, w, h, size = 34) => sl.addText((pts || []).map((p) => run(p, { bullet: { code: "25CF" }, paraSpaceAfter: 10, color: C.ink2 })), { x, y, w, h, fontFace: F, fontSize: PT(size * big), valign: "top", margin: 0, fit: "shrink" });

    switch (s.layout) {
      case "title": {
        if (t.band) sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: X(36), h: X(1080), fill: { color: C.p }, line: { color: C.p } });
        sl.addShape(pptx.ShapeType.rect, { x: X(120), y: X(250), w: X(120), h: X(8), fill: { color: C.p }, line: { color: C.p } });
        sl.addText(clean(s.title), { x: X(120), y: X(290), w: X(1680), h: X(260), fontFace: FH, fontSize: PT(72), bold: true, color: C.ink, valign: "top", margin: 0, fit: "shrink" });
        if (s.subtitle) sl.addText(clean(s.subtitle), { x: X(120), y: X(570), w: X(1680), h: X(100), fontFace: F, fontSize: PT(32), color: C.ink2, margin: 0 });
        sl.addText([run(s.presenter || deck.meta?.presenter || "", { bold: true, color: C.p, fontSize: PT(34), breakLine: true }), { text: clean(s.affiliation || deck.meta?.affiliation || ""), options: { color: C.muted, fontSize: PT(26), breakLine: true } }, { text: clean(s.event || deck.meta?.event || ""), options: { color: C.muted, fontSize: PT(24) } }], { x: X(120), y: X(780), w: X(1680), h: X(200), fontFace: F, valign: "bottom", margin: 0 });
        break;
      }
      case "section":
        sl.addText(clean(s.title), { x: X(140), y: X(380), w: X(1640), h: X(220), fontFace: FH, fontSize: PT(88), bold: true, color: C.bg, margin: 0, fit: "shrink" });
        if (s.subtitle) sl.addText(clean(s.subtitle), { x: X(140), y: X(630), w: X(1640), h: X(90), fontFace: F, fontSize: PT(36), color: C.bg, margin: 0 });
        break;
      case "bullets":
        titleBox(); bullets(s.points, X(L), top, X(W), bodyH, (s.points || []).length <= 3 ? 38 : 34); break;
      case "two-col": {
        titleBox();
        const cw = (W - 80) / 2;
        [[s.left, L], [s.right, L + cw + 80]].forEach(([col, x]) => {
          sl.addText(clean(col?.heading), { x: X(x), y: top, w: X(cw), h: X(60), fontFace: FH, fontSize: PT(32), bold: true, color: C.p, margin: 0 });
          bullets(col?.points, X(x), top + X(80), X(cw), bodyH - X(80), 30);
        });
        sl.addShape(pptx.ShapeType.line, { x: X(L + cw + 40), y: top, w: 0, h: bodyH - X(40), line: { color: C.line, width: 1.5 } });
        break;
      }
      case "big-numbers": {
        titleBox();
        const nums = (s.numbers || []).slice(0, 3);
        const cw = W / Math.max(1, nums.length);
        nums.forEach((n, k) => {
          sl.addText(clean(n.value), { x: X(L + k * cw), y: X(320), w: X(cw - 40), h: X(170), fontFace: FH, fontSize: PT(140), bold: true, color: n.role === "int" ? C.int : n.role === "ctl" ? C.ctl : C.p, margin: 0, fit: "shrink" });
          sl.addText([run(n.label, {})], { x: X(L + k * cw), y: X(500), w: X(cw - 40), h: X(110), fontFace: F, fontSize: PT(26), color: C.ink2, valign: "top", margin: 0 });
        });
        if (s.caption) sl.addText([run(s.caption, {})], { x: X(L), y: X(700), w: X(W), h: X(120), fontFace: F, fontSize: PT(28), color: C.ink2, margin: 0 });
        break;
      }
      case "table": {
        titleBox();
        const hl = new Set([].concat(s.highlight ?? []).map(Number));
        const head = (s.columns || []).map((c, k) => ({ text: clean(c), options: { bold: true, color: C.muted, fill: { color: hl.has(k) ? C.pl : C.bg } } }));
        const rows = (s.rows || []).slice(0, 9).map((r) => r.map((c, k) => ({ text: clean(c), options: { bold: k === 0, color: need(c) ? "5A3B00" : C.ink, fill: { color: need(c) ? "FFE58A" : hl.has(k) ? C.pl : C.bg } } })));
        sl.addTable([head, ...rows], { x: X(L), y: top, w: X(W), fontFace: F, fontSize: PT(26), border: { type: "solid", pt: 0.75, color: C.line }, margin: 0.08, autoPage: false });
        break;
      }
      case "bar-chart": {
        titleBox();
        const data = (s.series || []).map((se) => ({ name: se.name, labels: s.categories || [], values: se.values || [] }));
        sl.addChart(pptx.ChartType.bar, data, {
          x: X(L), y: top, w: X(W), h: s.caption ? bodyH - X(90) : bodyH, barDir: "col", barGapWidthPct: 60,
          chartColors: (s.series || []).map((se, k) => roleColor(se.role, k)),
          showValue: true, dataLabelFontSize: PT(26), dataLabelColor: C.ink, dataLabelFormatCode: s.unit === "%" ? '0.0"%"' : "0.0",
          showLegend: true, legendPos: "t", legendFontSize: PT(26), legendFontFace: F, legendColor: C.ink2,
          catAxisLabelFontSize: PT(26), catAxisLabelColor: C.ink2, catAxisLabelFontFace: F, valAxisLabelFontSize: PT(22), valAxisLabelColor: C.muted,
          valGridLine: { color: C.line, size: 0.75 }, catGridLine: { style: "none" }, valAxisTitle: s.unit || "", showValAxisTitle: Boolean(s.unit && s.unit !== "%"),
        });
        if (s.caption) sl.addText([run(s.caption, {})], { x: X(L), y: top + bodyH - X(70), w: X(W), h: X(60), fontFace: F, fontSize: PT(26), color: C.ink2, margin: 0 });
        break;
      }
      case "timeline": {
        titleBox();
        const ev = (s.events || []).slice(0, 7);
        const cw = W / Math.max(1, ev.length);
        const ay = 236 + 262;
        sl.addShape(pptx.ShapeType.line, { x: X(L), y: X(ay), w: X(W), h: 0, line: { color: C.line, width: 3 } });
        ev.forEach((e, k) => {
          const x = L + k * cw;
          sl.addText([run(e.when, {})], { x: X(x), y: X(ay - 110), w: X(cw - 24), h: X(80), fontFace: FH, fontSize: PT(34), bold: true, color: C.p, valign: "bottom", margin: 0 });
          sl.addShape(pptx.ShapeType.ellipse, { x: X(x), y: X(ay - 12), w: X(24), h: X(24), fill: { color: C.bg }, line: { color: C.p, width: 3 } });
          sl.addText([run(e.what, { bold: true, color: C.ink, fontSize: PT(30), breakLine: true }), run(e.detail, { color: C.ink2, fontSize: PT(26) })], { x: X(x), y: X(ay + 50), w: X(cw - 24), h: X(260), fontFace: F, valign: "top", margin: 0 });
        });
        break;
      }
      case "flow": {
        titleBox();
        const st = (s.steps || []).slice(0, 6);
        const gap = 70, bw = (W - gap * (st.length - 1)) / Math.max(1, st.length);
        st.forEach((x, k) => {
          const bx = L + k * (bw + gap);
          sl.addText([run(x.label, { bold: true, color: C.ink, fontSize: PT(30), breakLine: true }), run(x.detail || "", { color: C.ink2, fontSize: PT(24) })], { shape: pptx.ShapeType.roundRect, rectRadius: 0.08, x: X(bx), y: X(306), w: X(bw), h: X(420), fill: { color: C.pl }, line: { color: C.p, width: 2 }, fontFace: F, valign: "middle", margin: 10 });
          if (k) sl.addShape(pptx.ShapeType.rightArrow, { x: X(bx - gap + 14), y: X(500), w: X(gap - 28), h: X(36), fill: { color: C.p }, line: { color: C.p } });
        });
        break;
      }
      case "decision": {
        titleBox();
        sl.addText([run(s.question, {})], { shape: pptx.ShapeType.roundRect, rectRadius: 0.06, x: X(L + 314), y: top, w: X(1100), h: X(130), fill: { color: C.pl }, line: { color: C.p, width: 2 }, fontFace: FH, fontSize: PT(38), bold: true, color: C.ink, align: "center", valign: "middle" });
        const cy = 236 + 250;
        sl.addShape(pptx.ShapeType.line, { x: X(L + 864), y: top + X(130), w: 0, h: X(120), line: { color: C.ink2, width: 2 } });
        sl.addShape(pptx.ShapeType.line, { x: X(L + 400), y: X(cy), w: X(928), h: 0, line: { color: C.ink2, width: 2 } });
        [[s.yes, L + 40, C.int, "Có"], [s.no, L + 968, C.ctl, "Không"]].forEach(([b, x, col, def]) => {
          sl.addShape(pptx.ShapeType.line, { x: X(x + 360), y: X(cy), w: 0, h: X(110), line: { color: col, width: 2, endArrowType: "triangle" } });
          sl.addText([{ text: clean(b?.label || def).toUpperCase(), options: { bold: true, color: col, fontSize: PT(24), breakLine: true } }, run(b?.outcome, { color: C.ink, fontSize: PT(32) })], { shape: pptx.ShapeType.roundRect, rectRadius: 0.06, x: X(x), y: X(cy + 110), w: X(720), h: X(220), fill: { color: C.bg }, line: { color: col, width: 2 }, fontFace: F, valign: "top", margin: 12 });
        });
        if (s.note) sl.addText([run(s.note, {})], { x: X(L), y: X(1080 - 160), w: X(W), h: X(50), fontFace: F, fontSize: PT(24), color: C.muted, margin: 0 });
        break;
      }
      case "trial-schema": {
        titleBox();
        const y0 = 236;
        sl.addText([{ text: lang === "en" ? "POPULATION" : "DÂN SỐ", options: { bold: true, color: C.muted, fontSize: PT(20), breakLine: true } }, run(s.population, { color: C.ink, fontSize: PT(26) })], { x: X(L), y: X(y0 + 150), w: X(420), h: X(420), line: { color: C.ink2, width: 2 }, fontFace: F, valign: "middle", margin: 12 });
        sl.addShape(pptx.ShapeType.line, { x: X(L + 420), y: X(y0 + 360), w: X(100), h: 0, line: { color: C.ink2, width: 2 } });
        sl.addText("R", { shape: pptx.ShapeType.ellipse, x: X(L + 520), y: X(y0 + 300), w: X(120), h: X(120), fill: { color: C.p }, line: { color: C.p }, color: "FFFFFF", fontFace: FH, fontSize: PT(56), bold: true, align: "center", valign: "middle" });
        sl.addText([run(s.randomization, {})], { x: X(L + 460), y: X(y0 + 440), w: X(240), h: X(100), fontFace: F, fontSize: PT(22), color: C.ink2, align: "center", valign: "top", margin: 0 });
        const arms = (s.arms || []).slice(0, 3);
        const armH = Math.min(220, (600 - 40 * (arms.length - 1)) / Math.max(1, arms.length));
        const start = y0 + (600 - (arms.length * armH + (arms.length - 1) * 40)) / 2 + 60;
        arms.forEach((a, k) => {
          const ty = start + k * (armH + 40);
          const col = a.role === "int" ? C.int : C.ctl, fill = a.role === "int" ? C.intl : C.ctll;
          sl.addShape(pptx.ShapeType.line, { x: X(L + 640), y: X(Math.min(y0 + 360, ty + armH / 2)), w: X(120), h: X(Math.abs(ty + armH / 2 - (y0 + 360))), flipV: ty + armH / 2 < y0 + 360, line: { color: C.ink2, width: 2 } });
          sl.addText([run(a.name, { bold: true, color: C.ink, fontSize: PT(30), breakLine: true }), run(a.detail, { color: C.ink, fontSize: PT(26) })], { x: X(L + 760), y: X(ty), w: X(560), h: X(armH), fill: { color: fill }, line: { color: col, width: 2 }, fontFace: F, valign: "middle", margin: 12 });
        });
        sl.addText([{ text: lang === "en" ? "ENDPOINTS" : "TIÊU CHÍ ĐÁNH GIÁ", options: { bold: true, color: C.muted, fontSize: PT(20), breakLine: true } }, run(s.primary, { bold: true, color: C.ink, fontSize: PT(24), breakLine: true }), ...(s.secondary || []).slice(0, 4).map((x) => run(x, { color: C.ink2, fontSize: PT(22), breakLine: true }))], { x: X(L + 1400), y: X(y0 + 120), w: X(328), h: X(480), line: { color: C.p, width: 2, dashType: "dash" }, fontFace: F, valign: "middle", margin: 12 });
        break;
      }
      case "recommendations": {
        titleBox();
        const clsCol = (c) => { const k = String(c || "").toUpperCase().replace(/\s/g, ""); return k === "I" ? "2E7D32" : k === "IIA" ? "9E9D24" : k === "IIB" ? "EF8F00" : k.startsWith("III") ? "C62828" : "78909C"; };
        const head = [lang === "en" ? "Recommendation" : "Khuyến cáo", "Class", "Level", lang === "en" ? "Source" : "Nguồn"].map((h) => ({ text: h, options: { bold: true, color: C.muted } }));
        const rows = (s.items || []).slice(0, 7).map((r) => [
          { text: clean(r.text), options: { color: C.ink } },
          { text: clean(r.class || "–"), options: { bold: true, color: "FFFFFF", fill: { color: clsCol(r.class) }, align: "center" } },
          { text: clean(r.level || "–"), options: { bold: true, color: C.ink, align: "center" } },
          { text: clean(ctx.shortCite(String(r.source || "").replace(/[[\]]/g, "")) || r.source || ""), options: { color: C.muted, fontSize: PT(20) } },
        ]);
        sl.addTable([head, ...rows], { x: X(L), y: top, w: X(W), colW: [X(1100), X(140), X(140), X(W - 1380)], fontFace: F, fontSize: PT(26), border: { type: "solid", pt: 0.75, color: C.line }, margin: 0.08 });
        break;
      }
      case "quiz": {
        titleBox();
        sl.addText([run(s.question, {})], { x: X(L), y: top, w: X(W), h: X(140), fontFace: FH, fontSize: PT(44), bold: true, color: C.ink, valign: "top", margin: 0, fit: "shrink" });
        const cw = (W - 40) / 2;
        (s.options || []).slice(0, 4).forEach((o, k) => {
          const ok = k === s.answer;
          sl.addText([run(o, {})], { shape: pptx.ShapeType.roundRect, rectRadius: 0.05, x: X(L + (k % 2) * (cw + 40)), y: X(436 + Math.floor(k / 2) * 130), w: X(cw), h: X(100), line: { color: C.line, width: 1.5 }, fontFace: F, fontSize: PT(32), color: C.ink, valign: "middle", margin: 12 });
          if (ok) sl.addNotes(`${clean(s.notes || "")}\n\nĐáp án: ${clean(o)}. ${clean(s.explain || "")}`);
        });
        break;
      }
      case "statement": {
        titleBox();
        (s.points || []).slice(0, 3).forEach((p, k) => {
          sl.addText(String(k + 1), { shape: pptx.ShapeType.ellipse, x: X(L), y: X(316 + k * 170), w: X(76), h: X(76), fill: { color: C.p }, line: { color: C.p }, color: C.bg, fontFace: FH, fontSize: PT(40), bold: true, align: "center", valign: "middle" });
          sl.addText([run(p, {})], { x: X(L + 110), y: X(300 + k * 170), w: X(W - 110), h: X(140), fontFace: F, fontSize: PT(44), bold: true, color: C.ink, valign: "top", margin: 0, fit: "shrink" });
        });
        break;
      }
      case "references": {
        titleBox();
        const refs = ctx.refList.map((r) => ({ text: formatVancouver(r), options: { bullet: { type: "number" }, paraSpaceAfter: 6, breakLine: true } }));
        sl.addText(refs.length ? refs : [{ text: "Chưa có tài liệu tham khảo." }], { x: X(L), y: top, w: X(W), h: bodyH, fontFace: F, fontSize: refs.length > 8 ? 10 : 12, color: C.ink2, valign: "top", margin: 0, fit: "shrink" });
        break;
      }
      case "image": {
        titleBox();
        if (s.src && /^data:image\//.test(s.src)) sl.addImage({ data: s.src, x: X(L), y: top, w: X(W), h: bodyH - X(80), sizing: { type: "contain", w: X(W), h: bodyH - X(80) } });
        else sl.addText("[CẦN BỔ SUNG: hình ảnh]", { x: X(L), y: top, w: X(W), h: X(80), fontFace: F, fontSize: 16, highlight: "FFE58A" });
        if (s.caption || s.credit) sl.addText(clean([s.caption, s.credit].filter(Boolean).join(" — ")), { x: X(L), y: top + bodyH - X(70), w: X(W), h: X(60), fontFace: F, fontSize: PT(24), color: C.muted, margin: 0 });
        break;
      }
      default:
        titleBox(); bullets(s.points || [s.text || ""], X(L), top, X(W), bodyH);
    }
    footer();
  });
  return pptx.write({ outputType: "nodebuffer" });
}
