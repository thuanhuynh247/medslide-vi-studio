// audit.mjs — Kiểm định tự động trước khi trình chiếu. Port từ grand-rounds (MIT):
//  slop-audit/lint_slop.py (S01–S21 phần máy bắt được), evidence-audit/phi_scan.py, check_claims.py, verify_refs.py
import { verifyReference } from "./evidence.mjs";

const UP = "A-ZÀ-ỸĐ";
const NAME = `[${UP}][a-zà-ỹđ]+`;

const PHI = [
  ["ngày tháng", /\b\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)?\d{2}\b/g],
  ["ngày tháng", /\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g],
  ["ngày tháng", /\bngày\s+\d{1,2}\s+tháng\s+\d{1,2}(?:\s+năm\s+\d{4})?/gi],
  ["mã hồ sơ", /\b(?:MRN|PID|mã\s*(?:BN|bệnh\s*nhân|hồ\s*sơ|y\s*tế)|số\s*(?:hồ\s*sơ|vào\s*viện|lưu\s*trữ|bệnh\s*án)|SBA|SVV|BHYT)\s*[:#]?\s*[A-Z0-9][A-Z0-9/-]{3,}/gi],
  ["dãy số dài (CCCD/BHYT?)", /(?<![\d.,])\d{9,}(?![\d.,])/g],
  ["số điện thoại", /(?<!\d)(?:\+84[\s.-]?|0)\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}(?!\d|[.,]\d)/g],
  ["email", /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g],
  ["họ tên người bệnh", new RegExp(`\\b(?:[Bb]ệnh\\s+nhân|BN|[Pp]atient|Mr\\.?|Mrs\\.?|Ms\\.?|[Ôô]ng|[Bb]à|[Cc]hị|[Aa]nh|[Cc]háu|[Bb]é)[ \\t]+(${NAME}(?:[ \\t]+${NAME}){1,3})`, "g")],
  ["chữ cái đầu", new RegExp(`\\b[${UP}]\\.\\s?[${UP}]\\.(?:\\s?[${UP}]\\.)?`, "g")],
  ["địa chỉ", /(?<![\p{L}])(?<!tháo\s)(?:[Ss]ố\s+nhà|[Đđ]ường|[Pp]hường|[Xx]ã|[Tt]hôn|[Ấấ]p|[Tt]ổ\s+dân\s+phố|[Ss]treet|[Rr]oad|[Ww]ard)[ \t]+(?:\p{Lu}|\d)[\p{L}\d/]*/gu],
];

const SLOP = [
  ["S02", "blocking", "lời nhắc người trình bày nằm trên slide", /(bấm tiếp|nhấn tiếp|click (for|to)|▸|\(hiệu ứng\)|\(animation\)|press n\b|hover)/i],
  ["S03", "blocking", "kể quy trình làm slide", /(đổi màu|vẽ lại|tạo bởi ai|do ai tạo|generated with|adapted by ai|redrawn|recolou?red|hình gốc)/i],
  ["S04", "blocking", "chữ giữ chỗ", /(lorem ipsum|\bTODO\b|\[insert|XX%|\{\{)/i],
  ["S15", "advisory", "sáo ngữ", /(bước ngoặt|cuộc cách mạng|điểm nhấn|đột phá|khám phá ngay|game[- ]changer|key takeaways|let'?s dive|paradigm shift|revolutioni[sz]e|unlock)/i],
  ["S16", "advisory", "emoji / ký hiệu trang trí", /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}✅✨🚀]/u],
  ["S14", "advisory", "cấu trúc 'không chỉ X — mà là Y'", /(không chỉ|not (just|only)).{0,40}[—–-]{1,2}/i],
  ["S20", "advisory", "giải thích điều hiển nhiên", /(như hình (trên|dưới) cho thấy|biểu đồ (này|trên) cho thấy|as we can see|this (chart|slide) shows)/i],
];
const TOPIC_TITLES = /^(kết quả|tổng quan|giới thiệu|phương pháp|bàn luận|thảo luận|kết luận|results?|methods?|introduction|background|discussion|conclusions?|overview|đặt vấn đề|mục lục|nội dung)$/i;
const HYPE = /(cải thiện|giảm|tăng|vượt trội|hiệu quả hơn|improv|reduc|superior)/i;

export function slideText(s) {
  const parts = [s.title, s.subtitle, s.caption, s.question, s.population, s.randomization, s.primary, s.note, s.explain];
  const push = (x) => { if (x == null) return; if (Array.isArray(x)) x.forEach(push); else if (typeof x === "object") Object.values(x).forEach(push); else parts.push(String(x)); };
  push(s.points); push(s.left); push(s.right); push(s.numbers); push(s.columns); push(s.rows); push(s.events); push(s.steps);
  push(s.yes); push(s.no); push(s.arms); push(s.secondary); push(s.items); push(s.options); push(s.categories);
  if (s.series) s.series.forEach((x) => { parts.push(x.name); (x.values || []).forEach((v) => parts.push(String(v))); });
  return parts.filter(Boolean).join(" \n ");
}

function bodyText(s) {
  const t = { ...s, title: "", notes: "" };
  return slideText(t);
}

const wordCount = (str) => String(str || "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// chuẩn hóa số: '82,2%' '1.137' '0.58' '−0,45' → số thực
function canon(tok) {
  let t = tok.replace(/[−–]/g, "-").replace(/%/g, "").trim();
  const neg = t.startsWith("-"); t = t.replace(/^-/, "");
  const seps = t.match(/[.,]/g) || [];
  if (seps.length > 1) {
    if (new Set(seps).size === 1) t = t.split(seps[0]).join("");
    else { const dec = seps[seps.length - 1]; t = t.split(dec === "," ? "." : ",").join("").replace(dec, "."); }
  } else if (seps.length === 1) {
    const [a, b] = t.split(/[.,]/);
    t = b.length === 3 && a !== "0" ? a + b : a + "." + b; // 1.137 → 1137; 0,58 → 0.58
  }
  const v = parseFloat(t);
  return Number.isFinite(v) ? (neg ? -v : v) : null;
}

const NUM = /(?<![\w.,])[-−–]?\d+(?:[.,]\d+)*(?:\s?%)?/g;
function numbersIn(text) {
  const clean = String(text)
    .replace(/\[(CẦN BỔ SUNG|NEED)[^\]]*\]/g, " ")
    .replace(/\b10\.\d{4,9}\/\S+/g, " ").replace(/\b(?:PMID|NCT|PMC)\s*:?\s*\w+/gi, " ")
    .replace(/\b(?:KTC|CI)\s*(?:90|95|99)\s?%|(?:90|95|99)\s?%\s*(?:CI|KTC)/gi, " ")
    .replace(/\bN\d+\b/g, " ").replace(/\b(?:NYHA|class|độ|giai đoạn|type|typ|loại)\s+[IVX\d]+/gi, " ");
  const out = [];
  for (const m of clean.matchAll(NUM)) {
    const raw = m[0].trim();
    const v = canon(raw);
    if (v === null) continue;
    if (!raw.includes("%") && Number.isInteger(v) && v >= 0 && v <= 10) continue; // số nhỏ đếm
    if (!raw.includes("%") && v >= 1900 && v <= 2100 && Number.isInteger(v)) continue; // năm
    out.push({ raw, v });
  }
  return out;
}
const close = (a, b) => Math.abs(a - b) < 1e-6 || (Math.abs(b) > 0 && Math.abs(a - b) / Math.abs(b) < 0.0005);

export async function auditDeck(project, { verifyRefs = true } = {}) {
  const deck = project.deck;
  const findings = [];
  const add = (f) => findings.push(f);
  const claims = deck.claims || [];
  const refIds = new Set([...(project.evidence || []).map((e) => e.id), ...(project.sources || []).map((s) => s.id)]);
  const isCase = ["ca-lam-sang", "mm"].includes(project.brief?.deckType);

  deck.slides.forEach((s, i) => {
    const n = i + 1;
    const txt = slideText(s);
    // ---- slop ----
    for (const [code, sev, label, re] of SLOP) {
      const m = re.exec(txt);
      if (m) add({ code, severity: sev, slide: n, slideId: s.id, problem: `${label}: "${m[0]}"`, fix: code === "S02" ? "Chuyển lời nhắc vào speaker notes." : "Xóa hoặc nói cụ thể." });
    }
    if (/\[(CẦN BỔ SUNG|NEED)/.test(txt)) {
      const items = [...txt.matchAll(/\[(?:CẦN BỔ SUNG|NEED)[^\]]*\]/g)].map((m) => m[0]);
      add({ code: "S04", severity: "blocking", slide: n, slideId: s.id, problem: `Còn ${items.length} ô cần bổ sung: ${[...new Set(items)].slice(0, 3).join(", ")}`, fix: "Điền số liệu từ nguồn, hoặc xóa ý đó." });
    }
    if (!["title", "section", "references", "quiz"].includes(s.layout)) {
      if (TOPIC_TITLES.test(String(s.title || "").trim())) add({ code: "S17", severity: "blocking", slide: n, slideId: s.id, problem: `Tiêu đề chủ đề "${s.title}"`, fix: "Viết tiêu đề là câu khẳng định kết luận của slide." });
      const wc = wordCount(bodyText(s));
      const limit = ["table", "recommendations", "trial-schema"].includes(s.layout) ? 90 : 45;
      if (wc > limit) add({ code: "S18", severity: "advisory", slide: n, slideId: s.id, problem: `Quá nhiều chữ: ${wc} chữ thân bài (ngưỡng ${limit})`, fix: "Chuyển chi tiết sang notes hoặc tách slide." });
      if (wordCount(s.title) > 22) add({ code: "S18", severity: "advisory", slide: n, slideId: s.id, problem: `Tiêu đề dài ${wordCount(s.title)} chữ`, fix: "Rút tiêu đề còn ≤ 16 chữ." });
    }
    if (i > 0 && s.layout === deck.slides[i - 1].layout && !["section", "statement", "recommendations"].includes(s.layout)) {
      const prev = i > 1 && deck.slides[i - 2].layout === s.layout;
      if (prev) add({ code: "S12", severity: "advisory", slide: n, slideId: s.id, problem: `Ba slide liền cùng layout "${s.layout}"`, fix: "Chọn hình ảnh theo loại bằng chứng (ngữ pháp hình ảnh)." });
    }
    // ---- PHI ----
    if (!["references", "title"].includes(s.layout)) {
      for (const [kind, re] of PHI) {
        for (const m of txt.matchAll(re)) {
          add({ code: "E-PHI", severity: isCase ? "blocking" : "advisory", slide: n, slideId: s.id, problem: `Có thể lộ danh tính (${kind}): "${m[0]}"`, fix: "Dùng ngày tương đối (N0, N3), bỏ tên, mã, địa chỉ." });
        }
      }
    }
    // ---- số liệu không có nguồn (check_claims) ----
    if (!["title", "section", "references", "quiz", "timeline"].includes(s.layout)) {
      const slideClaims = claims.filter((c) => c.slideId === s.id || (!c.slideId && +c.slide === n));
      const claimNums = slideClaims.flatMap((c) => [...c.values, c.text].flatMap((v) => numbersIn(v).map((x) => x.v)));
      const allClaimNums = claims.flatMap((c) => c.values.flatMap((v) => numbersIn(v).map((x) => x.v)));
      const nums = numbersIn(bodyText(s) + " " + (s.title || ""));
      const unsupported = [...new Map(nums.filter((x) => !claimNums.some((c) => close(c, x.v))).map((x) => [x.raw, x])).values()];
      if (unsupported.length) {
        const elsewhere = unsupported.filter((x) => allClaimNums.some((c) => close(c, x.v)));
        const none = unsupported.filter((x) => !elsewhere.includes(x));
        if (none.length) add({ code: "E-SRC", severity: (s.refs || []).length ? "advisory" : "blocking", slide: n, slideId: s.id, problem: `Số chưa có trong sổ cái nguồn: ${none.slice(0, 8).map((x) => x.raw).join(", ")}`, fix: "Đối chiếu với nguồn và ghi claim (trích nguyên văn), hoặc xóa số." });
        if (elsewhere.length) add({ code: "E-NUM", severity: "advisory", slide: n, slideId: s.id, problem: `Số có nguồn nhưng thuộc slide khác: ${elsewhere.slice(0, 6).map((x) => x.raw).join(", ")}`, fix: "Kiểm tra có lẫn kết cục/dân số giữa các slide." });
      }
      // ---- cường điệu: "giảm/cải thiện" khi KTC chứa 1 hoặc p ≥ 0,05 ----
      if (HYPE.test(s.title || "")) {
        for (const c of slideClaims) {
          const all = [...c.values, c.quote].join(" ");
          const ci = /(\d+[.,]\d+)\s*(?:–|-|to|đến)\s*(\d+[.,]\d+)/.exec(all);
          const p = /\b[pP]\s*=\s*(0[.,]\d+)/.exec(all);
          const crosses = ci && canon(ci[1]) < 1 && canon(ci[2]) > 1 && /(HR|OR|RR|hazard|odds|risk ratio|tỉ số)/i.test(all);
          if (crosses || (p && canon(p[1]) >= 0.05)) add({ code: "E-CLAIM", severity: "blocking", slide: n, slideId: s.id, problem: `Tiêu đề khẳng định hiệu quả nhưng ${crosses ? `KTC ${ci[1]}–${ci[2]} chứa 1` : `p = ${p[1]}`}`, fix: "Viết lại: không có khác biệt có ý nghĩa thống kê." });
        }
      }
    }
    for (const r of s.refs || []) if (!refIds.has(r)) add({ code: "E-REF", severity: "blocking", slide: n, slideId: s.id, problem: `Slide trích nguồn [${r}] không có trong danh sách nguồn`, fix: "Chọn đúng nguồn hoặc thêm bài báo qua tra cứu PubMed." });
  });

  // ---- sổ cái ----
  for (const c of claims) {
    if (c.source && !refIds.has(c.source)) add({ code: "E-SRC", severity: "blocking", slide: c.slide, slideId: c.slideId, problem: `Số liệu "${c.text}" trích nguồn [${c.source}] không tồn tại`, fix: "Sửa mã nguồn." });
    if (c.quote) {
      const qn = numbersIn(c.quote).map((x) => x.v);
      const miss = c.values.flatMap((v) => numbersIn(v)).filter((x) => !qn.some((q) => close(q, x.v)) && !qn.some((q) => close(q * 100, x.v) || close(q / 100, x.v)));
      if (miss.length && c.kind !== "derived") add({ code: "E-NUM", severity: "advisory", slide: c.slide, slideId: c.slideId, problem: `Giá trị ${miss.map((x) => x.raw).join(", ")} không thấy trong câu trích của "${c.text}"`, fix: "Mở nguồn, kiểm tra con số và kết cục." });
    } else if (c.kind !== "derived") {
      add({ code: "E-SRC", severity: "advisory", slide: c.slide, slideId: c.slideId, problem: `Số liệu "${c.text}" không có trích dẫn nguyên văn`, fix: "Bổ sung câu trích từ nguồn." });
    }
    // trích dẫn phải có thật trong văn bản nguồn
    const src = [...(project.evidence || []), ...(project.sources || [])].find((x) => x.id === c.source);
    const srcText = src ? (src.fulltext || src.abstract || src.text || "") : "";
    if (c.quote && srcText && srcText.length > 200) {
      const qn = c.quote.replace(/\s+/g, " ").toLowerCase().replace(/\.\.\.|…/g, "|").split("|").map((x) => x.trim()).filter((x) => x.length > 20);
      const hay = srcText.replace(/\s+/g, " ").toLowerCase();
      if (qn.length && !qn.some((frag) => hay.includes(frag.slice(0, 60)))) add({ code: "E-SRC", severity: "advisory", slide: c.slide, slideId: c.slideId, problem: `Câu trích cho "${c.text}" không tìm thấy nguyên văn trong nguồn [${c.source}]`, fix: "AI có thể đã diễn giải lại; mở nguồn đối chiếu." });
    }
    if (c.status === "unverified") add({ code: "E-SRC", severity: "advisory", slide: c.slide, slideId: c.slideId, problem: `Số liệu "${c.text}" chưa xác minh được`, fix: "Tìm toàn văn hoặc bỏ số." });
  }

  // ---- tài liệu tham khảo ----
  const refChecks = [];
  if (verifyRefs) {
    const toCheck = (project.evidence || []).filter((e) => e.selected !== false);
    for (const e of toCheck) {
      const r = await verifyReference(e);
      refChecks.push({ id: e.id, ...r, found: undefined });
      if (r.status === "fail" || r.status === "mismatch") add({ code: "E-REF", severity: "blocking", slide: null, problem: `[${e.id}] ${r.issues.join("; ")}`, fix: "Sửa thông tin tài liệu theo PubMed/Crossref." });
      else if (r.status === "unverifiable") add({ code: "E-REF", severity: "advisory", slide: null, problem: `[${e.id}] ${r.issues.join("; ")}`, fix: "Thêm PMID hoặc DOI." });
      else if (r.status === "error") add({ code: "E-REF", severity: "advisory", slide: null, problem: `[${e.id}] ${r.issues.join("; ")}`, fix: "Kiểm tra mạng rồi chạy lại." });
    }
  }
  if (isCase) add({ code: "E-PHI", severity: "advisory", slide: null, problem: "Ca lâm sàng: kiểm tra bằng mắt mọi hình ảnh (mặt, tên, ngày, mã hồ sơ in trên phim/ảnh) và xác nhận đã có đồng thuận", fix: "Quét PHI bằng chữ không thay được việc xem ảnh." });

  const blocking = findings.filter((f) => f.severity === "blocking").length;
  return {
    at: Date.now(), result: blocking ? "FAIL" : "PASS", blocking, advisory: findings.length - blocking,
    findings: findings.sort((a, b) => (a.severity === b.severity ? (a.slide || 0) - (b.slide || 0) : a.severity === "blocking" ? -1 : 1)),
    refChecks,
  };
}
