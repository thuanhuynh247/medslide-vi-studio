// AI giả cho kiểm thử: trả JSON đúng dạng cho từng bước, kèm rác như CLI thật (lời dẫn, ```json)
export default async function mock(prompt) {
  const wrap = (o) => "Đây là kết quả:\n```json\n" + JSON.stringify(o, null, 1) + "\n```\n";
  if (prompt.includes("PHỎNG VẤN")) return wrap({ questions: [{ id: "q1", q: "Phản biện hay chỉ tường thuật?", options: ["Phản biện", "Tường thuật"], recommended: "Phản biện", why: "khán giả nội trú" }], pubmedQuery: "dapagliflozin heart failure", coreMessageDraft: "Dapagliflozin giảm biến cố suy tim" });
  if (prompt.includes("Lập DÀN Ý")) return wrap({ coreMessage: "Dapagliflozin giảm biến cố", slides: [
    { n: 1, layout: "title", title: "Dapagliflozin giảm biến cố suy tim" },
    { n: 2, layout: "trial-schema", title: "Thiết kế 1:1", claimsNeeded: "n" },
    { n: 3, layout: "big-numbers", title: "Kết cục chính giảm từ 21,2% xuống 16,3%", claimsNeeded: "HR" },
    { n: 4, layout: "bar-chart", title: "Kết quả", claimsNeeded: "tỉ lệ" },
    { n: 5, layout: "references", title: "Tài liệu tham khảo" }] });
  if (prompt.includes("Dựng ĐÚNG các slide")) {
    const m = /SLIDE CẦN DỰNG LẦN NÀY:\n([\s\S]*?)\nĐỊNH DẠNG MỖI SLIDE/.exec(prompt);
    const plan = JSON.parse(m[1]);
    const slides = plan.map((p) => p.layout === "big-numbers"
      ? { n: p.n, layout: p.layout, title: p.title, numbers: [{ value: "16,3%", label: "Dapagliflozin", role: "int" }, { value: "21,2%", label: "Giả dược", role: "ctl" }], refs: ["nguon1"], notes: "nói" }
      : p.layout === "bar-chart" ? { n: p.n, layout: p.layout, title: p.title, unit: "%", categories: ["Chính"], series: [{ name: "Dapa", role: "int", values: ["16,3"] }, { name: "GD", role: "ctl", values: [21.2] }], refs: ["nguon1"] }
      : p.layout === "trial-schema" ? { n: p.n, layout: p.layout, title: p.title, population: "Suy tim EF ≤ 40%", randomization: "1:1", arms: [{ name: "Dapagliflozin", detail: "10 mg", role: "int" }, { name: "Giả dược", detail: "", role: "ctl" }], primary: "Tử vong tim mạch hoặc suy tim nặng lên", secondary: [] }
      : { n: p.n, layout: p.layout, title: p.title, subtitle: "Journal club" });
    return wrap({ slides, claims: [{ slide: 3, text: "kết cục chính", values: ["16,3%", "21,2%"], source: "nguon1", locator: "Results", quote: "primary outcome occurred in 16.3% vs 21.2%", kind: "observed", status: "verified-fulltext" }] });
  }
  if (prompt.includes("Sửa MỘT slide")) return wrap({ slide: { layout: "bullets", title: "Đã sửa theo yêu cầu", points: ["Một", "Hai"] }, claims: [] });
  if (prompt.includes("PHẢN BIỆN")) return wrap({ findings: [{ code: "E-CLAIM", slide: 4, severity: "advisory", problem: "Tiêu đề chủ đề", fix: "Viết khẳng định" }], summary: "1 lưu ý" });
  return '{"ok":"Xin chào"}';
}
