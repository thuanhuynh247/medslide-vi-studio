// render-html.mjs — Dựng deck HTML một file, chạy offline, từ JSON slide.
// Lõi trình chiếu: deck-engine.html của grand-rounds (sân khấu 1920×1080, fragment, notes, laser/khoanh/bút).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { theme, themeCss } from "./themes.mjs";
import { formatVancouver } from "./evidence.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(__dirname, "..", "assets", "deck-engine.html");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// chữ thường + đánh dấu ô [CẦN BỔ SUNG: …] cho người trình bày thấy
const tx = (s) => esc(s).replace(/\[(CẦN BỔ SUNG|NEED)[^\]]*\]/g, (m) => `<mark class="need">${m}</mark>`).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

export function fmtNum(v, lang) {
  if (!Number.isFinite(v)) return "";
  const d = Math.abs(v) < 10 && v % 1 ? (String(v).split(".")[1] || "").length : v % 1 ? 1 : 0;
  return v.toLocaleString(lang === "en" ? "en-US" : "vi-VN", { minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: Math.min(d, 2) });
}

const EXTRA_CSS = `
mark.need{background:#FFE58A;color:#5A3B00;border-radius:6px;padding:0 .2em;font-style:normal}
.slide .body{top:236px}
.slide h2.t{font-weight:700;letter-spacing:-.005em}
ul.pts{list-style:none;padding:0;margin:0}
ul.pts li{position:relative;padding-left:1.1em;margin:0 0 .55em}
ul.pts li::before{content:"";position:absolute;left:0;top:.55em;width:.42em;height:.42em;border-radius:50%;background:var(--primary)}
.pts.lg{font-size:calc(var(--body-size) * 1.12)}
.col h3{margin:0 0 22px;font-size:calc(var(--body-size) * .95);color:var(--primary);font-weight:700}
.cols.two{grid-template-columns:1fr 1fr;gap:80px}
.cols.two .col+.col{border-left:2px solid var(--line);padding-left:80px}
.nums{display:flex;gap:120px;align-items:flex-end;margin-top:60px}
.num .v{font-size:150px;font-weight:800;line-height:1;letter-spacing:-.02em;color:var(--primary)}
.num.int .v{color:var(--int)} .num.ctl .v{color:var(--ctl)}
.num .l{font-size:var(--small);color:var(--ink2);margin-top:18px;max-width:520px;line-height:1.3}
.caption{font-size:var(--small);color:var(--ink2);margin-top:70px;max-width:1500px;line-height:1.4}
table.tbl{font-size:26px}
table.tbl th{font-size:22px;color:var(--muted);text-transform:none}
table.tbl td.hl,table.tbl th.hl{background:var(--primary-l)}
table.tbl tr:last-child td{border-bottom:0}
table.tbl td:first-child{font-weight:600;color:var(--ink)}
.chart svg{width:100%;height:100%;overflow:visible}
.chart .bar{transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(0)}
.slide.play .chart .bar{transform:none;transition:transform .8s cubic-bezier(.2,.7,.2,1) var(--d,.2s)}
.tl{position:relative;height:100%}
.tl .axis{position:absolute;left:0;right:0;top:262px;height:4px;background:var(--line)}
.tl .ev{position:absolute;top:0;text-align:left;padding-right:24px}
.tl .ev .w{font-size:34px;font-weight:800;color:var(--primary);height:230px;display:flex;align-items:flex-end;padding-bottom:22px}
.tl .ev .dot{position:absolute;left:0;top:252px;width:24px;height:24px;border-radius:50%;background:var(--bg);border:5px solid var(--primary)}
.tl .ev .h{font-size:30px;font-weight:700;color:var(--ink);margin-top:70px;line-height:1.25}
.tl .ev .d{font-size:26px;color:var(--ink2);margin-top:10px;line-height:1.35}
.flow{display:flex;align-items:stretch;gap:0;height:420px;margin-top:70px}
.flow .st{flex:1;border:3px solid var(--primary);border-radius:var(--radius);background:var(--primary-l);padding:26px 26px;display:flex;flex-direction:column;justify-content:center}
.flow .st .h{font-size:30px;font-weight:700;color:var(--ink);line-height:1.2}
.flow .st .d{font-size:24px;color:var(--ink2);margin-top:12px;line-height:1.35}
.flow .ar{width:70px;flex:none;display:grid;place-items:center}
.flow .ar svg{width:46px;height:46px}
.dec{position:relative;height:100%}
.dec .q{position:absolute;left:314px;top:0;width:1100px;text-align:center;border:3px solid var(--primary);background:var(--primary-l);border-radius:var(--radius);padding:34px 40px;font-size:38px;font-weight:700;color:var(--ink)}
.dec svg.lines{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.dec .br{position:absolute;top:360px;width:720px;min-height:200px;border:3px solid var(--line);border-radius:var(--radius);padding:28px 34px;background:var(--bg)}
.dec .br.yes{left:40px;border-color:var(--int)} .dec .br.no{right:40px;border-color:var(--ctl)}
.dec .br .lb{font-size:24px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
.dec .br.yes .lb{color:var(--int)} .dec .br.no .lb{color:var(--ctl)}
.dec .br .o{font-size:32px;color:var(--ink);margin-top:10px;line-height:1.3}
.dec .nt{position:absolute;left:0;right:0;bottom:0;font-size:24px;color:var(--muted)}
.ts{position:relative;height:100%}
.ts .box{position:absolute;border-radius:var(--radius);padding:22px 26px;font-size:26px;line-height:1.3;color:var(--ink)}
.ts .pop-box{left:0;top:150px;width:420px;height:420px;border:3px solid var(--ink2);display:flex;flex-direction:column;justify-content:center}
.ts .lbl{font-size:20px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px}
.ts .r{position:absolute;left:520px;top:300px;width:120px;height:120px;border-radius:50%;background:var(--primary);color:#fff;display:grid;place-items:center;font-size:56px;font-weight:800}
.ts .rr{position:absolute;left:470px;top:440px;width:220px;text-align:center;font-size:22px;color:var(--ink2)}
.ts .arm{left:760px;width:560px;border:3px solid var(--ctl);background:var(--ctl-l)}
.ts .arm.int{border-color:var(--int);background:var(--int-l)}
.ts .arm b{display:block;font-size:30px;margin-bottom:6px}
.ts .ep{left:1400px;top:120px;width:328px;height:480px;border:3px dashed var(--primary);display:flex;flex-direction:column;justify-content:center;font-size:24px}
.ts .ep .p{font-weight:700;margin-bottom:16px}
.ts svg.lines{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rec .cls{display:inline-block;min-width:76px;text-align:center;border-radius:8px;padding:4px 10px;font-weight:800;color:#fff}
.rec .c1{background:#2E7D32}.rec .c2a{background:#9E9D24}.rec .c2b{background:#EF8F00}.rec .c3{background:#C62828}.rec .cx{background:#78909C}
.quiz .qq{font-size:44px;font-weight:700;color:var(--ink);line-height:1.25;margin-bottom:50px}
.quiz .opts{display:grid;grid-template-columns:1fr 1fr;gap:28px 40px}
.quiz .op{position:relative;border:3px solid var(--line);border-radius:var(--radius);padding:24px 30px;font-size:32px;color:var(--ink)}
.quiz .op .ok{position:absolute;inset:-3px;border:5px solid #2E7D32;border-radius:var(--radius);background:rgba(46,125,50,.08)}
.quiz .ex{margin-top:36px;font-size:28px;color:var(--ink2)}
.stm ol{margin:40px 0 0;padding:0;list-style:none;counter-reset:k}
.stm li{counter-increment:k;position:relative;padding-left:110px;margin-bottom:46px;font-size:44px;font-weight:600;line-height:1.25;color:var(--ink)}
.stm li::before{content:counter(k);position:absolute;left:0;top:-4px;width:76px;height:76px;border-radius:50%;background:var(--primary);color:var(--bg);display:grid;place-items:center;font-size:40px;font-weight:800}
.slide.section{background:var(--primary)}
.slide.section h2.sec{position:absolute;left:140px;right:140px;top:400px;margin:0;font-size:88px;line-height:1.1;color:var(--bg);font-family:var(--font-head)}
.slide.section .sub{position:absolute;left:140px;right:140px;top:640px;font-size:36px;color:var(--bg);opacity:.85}
.slide.section .ftr{color:var(--bg);opacity:.7}
.refs{font-size:22px} .refs.two{columns:2;column-gap:60px;font-size:19px} .refs li{break-inside:avoid}
.img-wrap{height:100%;display:flex;flex-direction:column;align-items:center}
.img-wrap img{max-width:100%;max-height:640px;object-fit:contain;border-radius:var(--radius)}
.slide.title .rule{position:absolute;left:120px;top:250px;width:120px;height:8px;background:var(--primary)}
.slide.title .ev{position:absolute;left:120px;bottom:90px;font-size:24px;color:var(--muted)}
`;

const BAND_CSS = `
.slide:not(.title):not(.section)::before{content:"";position:absolute;left:0;right:0;top:0;height:190px;background:var(--primary)}
.slide:not(.title):not(.section) h2.t{color:#fff;top:0;height:190px;display:flex;align-items:center}
.slide:not(.title):not(.section) .ftr{border-top:2px solid var(--line);padding-top:12px}
.slide.title{background:linear-gradient(90deg,var(--primary) 0 36px,var(--bg) 36px)}
`;

const PRINT_CSS = `
body.embed #tools,body.embed #notes{display:none!important}
@page{size:1920px 1080px;margin:0}
body.print{overflow:visible;background:#fff;height:auto}
body.print #stage{position:relative;left:0;top:0;transform:none!important;width:1920px;height:auto;overflow:visible;background:none}
body.print .slide{position:relative;opacity:1!important;visibility:visible!important;width:1920px;height:1080px;overflow:hidden;break-after:page;page-break-after:always;background:var(--bg)}
body.print .slide.section{background:var(--primary)}
body.print .a-in,body.print .pop,body.print .frag{opacity:1!important;animation:none!important;transform:none!important}
body.print .draw{stroke-dashoffset:0!important}
body.print .chart .bar{transform:none!important}
body.print #ink,body.print #laser,body.print #tools,body.print #notes{display:none!important}
`;

// ---------- từng layout ----------
function list(points, cls = "pts") {
  return `<ul class="${cls}">${(points || []).map((p, i) => `<li class="a-in" style="--d:${(0.15 + i * 0.12).toFixed(2)}s">${tx(p)}</li>`).join("")}</ul>`;
}

function barChart(s, lang) {
  const cats = s.categories || [];
  const series = (s.series || []).slice(0, 4);
  const W = 1728, H = s.caption ? 560 : 640, padL = 90, padB = 90, padT = 60;
  const max = Math.max(1, ...series.flatMap((x) => x.values || []));
  const niceStep = (() => { const raw = max / 4; const p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= raw); })();
  const top = Math.ceil(max / niceStep) * niceStep;
  const plotW = W - padL - 40, plotH = H - padB - padT;
  const gw = plotW / Math.max(1, cats.length);
  const bw = Math.min(140, (gw * 0.7) / Math.max(1, series.length));
  const color = (se, i) => se.role === "int" ? "var(--int)" : se.role === "ctl" ? "var(--ctl)" : ["var(--primary)", "var(--accent)", "var(--muted)", "var(--ink2)"][i % 4];
  let g = "";
  for (let k = 0; k <= top / niceStep; k++) {
    const v = k * niceStep, y = padT + plotH - (v / top) * plotH;
    g += `<line x1="${padL}" x2="${W - 40}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="${k ? 1 : 3}"/>`;
    g += `<text x="${padL - 16}" y="${y + 8}" text-anchor="end" font-size="22" fill="var(--muted)">${esc(fmtNum(v, lang))}</text>`;
  }
  cats.forEach((c, ci) => {
    const gx = padL + ci * gw + (gw - bw * series.length) / 2;
    series.forEach((se, si) => {
      const v = se.values?.[ci] ?? 0, h = (v / top) * plotH, x = gx + si * bw, y = padT + plotH - h;
      g += `<rect class="bar" style="--d:${(0.2 + ci * 0.15 + si * 0.08).toFixed(2)}s" x="${x + 6}" y="${y}" width="${bw - 12}" height="${Math.max(0, h)}" fill="${color(se, si)}" rx="4"/>`;
      g += `<text class="pop" style="--d:${(0.9 + ci * 0.15).toFixed(2)}s" x="${x + bw / 2}" y="${y - 14}" text-anchor="middle" font-size="28" font-weight="700" fill="var(--ink)">${esc(fmtNum(v, lang))}${esc(s.unit === "%" ? "%" : "")}</text>`;
    });
    g += `<text x="${padL + ci * gw + gw / 2}" y="${padT + plotH + 44}" text-anchor="middle" font-size="26" fill="var(--ink2)">${esc(c)}</text>`;
  });
  const legend = series.map((se, i) => `<span style="display:inline-flex;align-items:center;gap:12px;margin-right:44px"><i style="width:26px;height:26px;border-radius:5px;background:${color(se, i)};display:inline-block"></i>${esc(se.name)}</span>`).join("");
  const unit = s.unit && s.unit !== "%" ? `<text x="${padL}" y="${padT - 26}" font-size="22" fill="var(--muted)">${esc(s.unit)}</text>` : "";
  return `<div class="chart a-in"><div style="font-size:26px;color:var(--ink2);margin-bottom:6px">${legend}</div><svg viewBox="0 0 ${W} ${H}" style="width:${W}px;height:${H}px" font-family="var(--font)">${unit}${g}</svg></div>${s.caption ? `<div class="caption a-in" style="--d:1.2s;margin-top:4px">${tx(s.caption)}</div>` : ""}`;
}

function timeline(s) {
  const ev = (s.events || []).slice(0, 7);
  const w = 1728 / Math.max(1, ev.length);
  return `<div class="tl"><div class="axis a-in"></div>${ev.map((e, i) => `<div class="ev a-in" style="left:${i * w}px;width:${w}px;--d:${(0.2 + i * 0.18).toFixed(2)}s"><div class="w">${tx(e.when)}</div><span class="dot"></span><div class="h">${tx(e.what)}</div><div class="d">${tx(e.detail)}</div></div>`).join("")}</div>`;
}

function flow(s) {
  const st = (s.steps || []).slice(0, 6);
  const arrow = `<div class="ar"><svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg></div>`;
  return `<div class="flow">${st.map((x, i) => `${i ? arrow.replace('class="ar"', `class="ar a-in" style="--d:${(0.1 + i * 0.22).toFixed(2)}s"`) : ""}<div class="st a-in" style="--d:${(0.15 + i * 0.22).toFixed(2)}s"><div class="h">${tx(x.label)}</div>${x.detail ? `<div class="d">${tx(x.detail)}</div>` : ""}</div>`).join("")}</div>`;
}

function decision(s) {
  return `<div class="dec"><svg class="lines"><path class="draw" style="--d:.4s" pathLength="1" d="M864 130 L864 250 L400 250 L400 360" fill="none" stroke="var(--int)" stroke-width="4"/><path class="draw" style="--d:.4s" pathLength="1" d="M864 250 L1328 250 L1328 360" fill="none" stroke="var(--ctl)" stroke-width="4"/></svg>
<div class="q a-in">${tx(s.question)}</div>
<div class="br yes a-in" style="--d:.7s"><div class="lb">${tx(s.yes?.label || "Có")}</div><div class="o">${tx(s.yes?.outcome)}</div></div>
<div class="br no a-in" style="--d:.85s"><div class="lb">${tx(s.no?.label || "Không")}</div><div class="o">${tx(s.no?.outcome)}</div></div>
${s.note ? `<div class="nt">${tx(s.note)}</div>` : ""}</div>`;
}

function trialSchema(s, lang) {
  const arms = (s.arms || []).slice(0, 3);
  const h = 600, armH = Math.min(220, (h - 40 * (arms.length - 1)) / Math.max(1, arms.length));
  const tops = arms.map((_, i) => 60 + i * (armH + 40) + (h - (arms.length * armH + (arms.length - 1) * 40)) / 2 - 60);
  const ratio = (String(s.randomization || "").match(/\d+\s*:\s*\d+(\s*:\s*\d+)?/) || ["R"])[0].replace(/\s/g, "");
  let lines = `<path class="draw" pathLength="1" d="M420 360 L520 360" stroke="var(--ink2)" stroke-width="4" fill="none"/>`;
  tops.forEach((t, i) => { lines += `<path class="draw" style="--d:${0.5 + i * 0.1}s" pathLength="1" d="M640 360 C700 360 700 ${t + armH / 2} 760 ${t + armH / 2}" stroke="var(--ink2)" stroke-width="4" fill="none"/><path class="draw" style="--d:${0.8 + i * 0.1}s" pathLength="1" d="M1320 ${t + armH / 2} L1400 ${t + armH / 2}" stroke="var(--ink2)" stroke-width="3" stroke-dasharray="1" fill="none"/>`; });
  return `<div class="ts"><svg class="lines">${lines}</svg>
<div class="box pop-box a-in"><div class="lbl">${lang === "en" ? "Population" : "Dân số"}</div>${tx(s.population)}</div>
<div class="r a-in" style="--d:.35s">R</div><div class="rr a-in" style="--d:.4s">${tx(s.randomization || ratio)}</div>
${arms.map((a, i) => `<div class="box arm ${a.role === "int" ? "int" : ""} a-in" style="top:${tops[i]}px;height:${armH}px;--d:${(0.6 + i * 0.12).toFixed(2)}s"><b>${tx(a.name)}</b>${tx(a.detail)}</div>`).join("")}
<div class="box ep a-in" style="--d:1s"><div class="lbl">${lang === "en" ? "Endpoints" : "Tiêu chí đánh giá"}</div><div class="p">${tx(s.primary)}</div>${(s.secondary || []).slice(0, 4).map((x) => `<div>${tx(x)}</div>`).join("")}</div></div>`;
}

function clsBadge(c) {
  const k = String(c || "").toUpperCase().replace(/\s/g, "");
  const cls = k === "I" ? "c1" : k === "IIA" ? "c2a" : k === "IIB" ? "c2b" : k.startsWith("III") ? "c3" : "cx";
  return `<span class="cls ${cls}">${esc(c || "–")}</span>`;
}

function refsSlide(deck, ctx) {
  const used = ctx.refList;
  if (!used.length) return `<p style="font-size:28px;color:var(--muted)">Chưa có tài liệu tham khảo.</p>`;
  return `<ol class="refs ${used.length > 8 ? "two" : ""}">${used.map((r) => `<li>${esc(formatVancouver(r))}</li>`).join("")}</ol>`;
}

function slideHtml(s, i, deck, ctx) {
  const lang = deck.meta?.lang || "vi";
  const notes = s.notes ? `<aside class="notes">${esc(s.notes)}</aside>` : "";
  const cite = (s.refs || []).map((id) => ctx.shortCite(id)).filter(Boolean).join("; ");
  const attrs = `data-name="${esc((s.title || s.layout).slice(0, 60))}"${cite ? ` data-cite="${esc((lang === "en" ? "Source: " : "Nguồn: ") + cite)}"` : ""}`;
  const head = `<h2 class="t a-in">${tx(s.title)}</h2>`;
  const body = (inner) => `<section class="slide l-${s.layout}" ${attrs}>${head}<div class="body">${inner}</div>${notes}</section>`;
  switch (s.layout) {
    case "title":
      return `<section class="slide title" data-name="Tiêu đề"><div class="rule a-in"></div><h1 class="a-in" style="--d:.1s">${tx(s.title)}</h1>${s.subtitle ? `<div class="sub a-in" style="--d:.3s">${tx(s.subtitle)}</div>` : ""}<div class="who a-in" style="--d:.5s">${tx(s.presenter || deck.meta?.presenter || "")}<span>${tx(s.affiliation || deck.meta?.affiliation || "")}</span></div>${(s.event || deck.meta?.event) ? `<div class="ev a-in" style="--d:.6s">${tx(s.event || deck.meta.event)}</div>` : ""}${notes}</section>`;
    case "section":
      return `<section class="slide section" data-name="${esc(s.title)}"><h2 class="sec a-in">${tx(s.title)}</h2>${s.subtitle ? `<div class="sub a-in" style="--d:.25s">${tx(s.subtitle)}</div>` : ""}${notes}</section>`;
    case "bullets":
      return body(list(s.points, (s.points || []).length <= 3 ? "pts lg" : "pts"));
    case "two-col":
      return body(`<div class="cols two"><div class="col a-in" style="--d:.15s"><h3>${tx(s.left?.heading)}</h3>${list(s.left?.points)}</div><div class="col a-in" style="--d:.35s"><h3>${tx(s.right?.heading)}</h3>${list(s.right?.points)}</div></div>`);
    case "big-numbers":
      return body(`<div class="nums">${(s.numbers || []).slice(0, 3).map((n, k) => `<div class="num ${esc(n.role || "")} a-in" style="--d:${(0.2 + k * 0.2).toFixed(2)}s"><div class="v">${tx(n.value)}</div><div class="l">${tx(n.label)}</div></div>`).join("")}</div>${s.caption ? `<div class="caption a-in" style="--d:.9s">${tx(s.caption)}</div>` : ""}`);
    case "table": {
      const hl = new Set([].concat(s.highlight ?? []).map(Number));
      return body(`<table class="tbl a-in" style="--d:.15s"><thead><tr>${(s.columns || []).map((c, k) => `<th class="${hl.has(k) ? "hl" : ""}">${tx(c)}</th>`).join("")}</tr></thead><tbody>${(s.rows || []).slice(0, 9).map((r) => `<tr>${r.map((c, k) => `<td class="${hl.has(k) ? "hl" : ""}">${tx(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    }
    case "bar-chart":
      return body(barChart(s, lang));
    case "timeline":
      return body(timeline(s));
    case "flow":
      return body(flow(s));
    case "decision":
      return body(decision(s));
    case "trial-schema":
      return body(trialSchema(s, lang));
    case "recommendations":
      return body(`<table class="tbl rec a-in"><thead><tr><th>${lang === "en" ? "Recommendation" : "Khuyến cáo"}</th><th>Class</th><th>Level</th><th>${lang === "en" ? "Source" : "Nguồn"}</th></tr></thead><tbody>${(s.items || []).slice(0, 7).map((r) => `<tr><td style="font-weight:400">${tx(r.text)}</td><td>${clsBadge(r.class)}</td><td><b>${esc(r.level || "–")}</b></td><td style="font-weight:400;font-size:20px;color:var(--muted)">${esc(ctx.shortCite(String(r.source || "").replace(/[[\]]/g, "")) || r.source || "")}</td></tr>`).join("")}</tbody></table>`);
    case "quiz":
      return `<section class="slide l-quiz" ${attrs}>${head}<div class="body quiz"><div class="qq a-in">${tx(s.question)}</div><div class="opts">${(s.options || []).map((o, k) => `<div class="op a-in" style="--d:${(0.2 + k * 0.1).toFixed(2)}s">${tx(o)}${k === s.answer ? `<span class="ok" data-frag="1"></span>` : ""}</div>`).join("")}</div>${s.explain ? `<div class="ex" data-frag="1">${tx(s.explain)}</div>` : ""}</div>${notes}</section>`;
    case "statement":
      return body(`<div class="stm"><ol>${(s.points || []).slice(0, 3).map((p, k) => `<li class="a-in" style="--d:${(0.2 + k * 0.25).toFixed(2)}s">${tx(p)}</li>`).join("")}</ol></div>`);
    case "references":
      return `<section class="slide l-references" data-name="${esc(s.title)}" data-cite="">${head}<div class="body">${refsSlide(deck, ctx)}</div>${notes}</section>`;
    case "image":
      return body(`<div class="img-wrap a-in">${s.src ? `<img src="${esc(s.src)}" alt="${esc(s.caption || "")}">` : `<mark class="need">[CẦN BỔ SUNG: hình ảnh]</mark>`}${s.caption ? `<div class="caption" style="margin-top:20px">${tx(s.caption)}</div>` : ""}${s.credit ? `<div style="font-size:18px;color:var(--muted);margin-top:8px">${esc(s.credit)}</div>` : ""}</div>`);
    default:
      return body(list(s.points || [s.text || ""]));
  }
}

export function referenceContext(deck, project) {
  const pool = new Map();
  for (const e of project?.evidence || []) pool.set(e.id, e);
  for (const s of project?.sources || []) pool.set(s.id, { id: s.id, kind: "user-source", title: s.name, note: s.citation || "" });
  const order = [];
  const add = (id) => { if (pool.has(id) && !order.includes(id)) order.push(id); };
  for (const s of deck.slides || []) { (s.refs || []).forEach(add); (s.items || []).forEach((r) => add(String(r.source || "").replace(/[[\]]/g, ""))); }
  for (const c of deck.claims || []) add(c.source);
  // nguồn đã chọn mà chưa trích vẫn được liệt kê sau cùng
  for (const e of project?.evidence || []) if (e.selected !== false) add(e.id);
  const refList = order.map((id) => pool.get(id));
  const shortCite = (id) => {
    const r = pool.get(id);
    if (!r) return "";
    if (r.kind === "user-source") return r.citation || r.title;
    const a = (r.authors || [])[0] || "";
    return `${a}${(r.authors || []).length > 1 ? " et al." : ""} ${r.journal || ""} ${r.year || ""}`.replace(/\s+/g, " ").trim();
  };
  return { refList, shortCite };
}

export function renderDeckHtml(deck, project, { print = false } = {}) {
  const t = theme(deck.meta?.theme);
  let html = fs.readFileSync(ENGINE, "utf8");
  const ctx = referenceContext(deck, project);
  const slides = (deck.slides || []).map((s, i) => slideHtml(s, i, deck, ctx)).join("\n");
  const css = themeCss(deck.meta?.theme) + EXTRA_CSS + (t.band ? BAND_CSS : "") + PRINT_CSS;
  const title = `${deck.meta?.title || "Bài trình bày"}${deck.meta?.presenter ? " · " + deck.meta.presenter : ""}`;
  html = html.replace(/<html lang="en">/, `<html lang="${deck.meta?.lang === "en" ? "en" : "vi"}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace("</style>", css + "\n</style>")
    .replace(/<!-- ===== SLIDES:[\s\S]*?===== END SLIDES ===== -->/, () => slides)
    .replace('<body class="t-none" data-cite="">', `<body class="t-none${print ? " print" : ""}" data-cite="${esc(t.band && deck.meta?.affiliation ? deck.meta.affiliation : "")}">`)
    .replace("/* ---- per-deck code (figures, charts) goes here, before the engine ---- */",
      `/* MedSlide VI Studio */ if (/[?&]print/.test(location.search)) document.body.classList.add('print'); if (/[?&]embed/.test(location.search)) document.body.classList.add('embed');`);
  // chế độ in PDF (?print hoặc print=true): hiện mọi slide và fragment, không co giãn sân khấu
  html = html.replace("addEventListener('resize', fit); fit(); wake();", "if(!document.body.classList.contains('print')){addEventListener('resize', fit); fit(); wake();} else { slides.forEach(s=>{s.classList.add('active','play');$$('[data-frag]',s).forEach(e=>e.classList.add('frag','on'));}); }");
  html = html.replace("<!--\n  Grand Rounds HTML deck engine.", "<!--\n  Made with MedSlide VI Studio (huynhanhthuan.com). Engine: Grand Rounds HTML deck engine (MIT, Trần Quang Hưng).");
  return html;
}
