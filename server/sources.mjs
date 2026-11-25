// sources.mjs — Đọc tài liệu nguồn người dùng đưa vào (PDF, DOCX, TXT/MD) thành văn bản có đánh số trang
import path from "node:path";

export async function extractText(name, buf) {
  const ext = path.extname(String(name || "")).toLowerCase();
  if (ext === ".pdf") return extractPdf(buf);
  if (ext === ".docx") {
    const mammoth = (await import("mammoth")).default;
    const r = await mammoth.extractRawText({ buffer: buf });
    return { text: r.value.trim(), pages: 0 };
  }
  if ([".txt", ".md", ".csv", ".json", ".html", ".htm"].includes(ext)) {
    let t = buf.toString("utf8");
    if (ext.startsWith(".htm")) t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
    return { text: t.replace(/\r/g, "").trim(), pages: 0 };
  }
  throw new Error(`Chưa hỗ trợ định dạng ${ext || "(không đuôi)"}. Dùng PDF, DOCX, TXT hoặc MD.`);
}

async function extractPdf(buf) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    let line = "", lastY = null;
    const lines = [];
    for (const it of c.items) {
      const y = it.transform ? Math.round(it.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ""; }
      line += it.str + (it.hasEOL ? "\n" : "");
      lastY = y;
    }
    lines.push(line);
    out.push(`[trang ${i}]\n` + lines.join("\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim());
  }
  await doc.destroy();
  const text = out.join("\n\n");
  if (text.replace(/\[trang \d+\]/g, "").trim().length < 50) throw new Error("PDF không có lớp chữ (có thể là bản scan). Hãy dùng bản PDF có chữ hoặc dán nội dung.");
  return { text, pages: doc.numPages };
}

// Ghép nguồn cho prompt, giữ trong giới hạn ký tự
export function sourcesForPrompt(sources = [], evidence = [], maxChars = 90000) {
  const blocks = [];
  for (const s of sources) blocks.push({ id: s.id, head: `NGUỒN [${s.id}] — ${s.name} (tài liệu người dùng cung cấp)`, body: s.text || "" });
  for (const e of evidence.filter((x) => x.selected !== false)) {
    const head = `NGUỒN [${e.id}] — ${e.authors?.[0] || ""}${e.authors?.length > 1 ? " et al" : ""}. ${e.title}. ${e.journal} ${e.year}. PMID ${e.pmid || "-"}${e.doi ? " · doi " + e.doi : ""} (${e.fulltext ? "toàn văn" : "chỉ abstract"})`;
    blocks.push({ id: e.id, head, body: e.fulltext || e.abstract || "(không có abstract)" });
  }
  if (!blocks.length) return "";
  const per = Math.max(3000, Math.floor(maxChars / blocks.length));
  return blocks.map((b) => {
    const body = b.body.length > per ? b.body.slice(0, per) + "\n…[đã cắt bớt]" : b.body;
    return `=== ${b.head} ===\n${body}`;
  }).join("\n\n");
}
