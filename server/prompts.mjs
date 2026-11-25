// prompts.mjs — Bộ tri thức làm slide Y khoa, gộp từ 3 dự án mã nguồn mở (MIT):
//  • grand-rounds (Trần Quang Hưng): phỏng vấn trước, tiêu đề khẳng định, ngữ pháp hình ảnh y khoa,
//    sổ cái số liệu (claims), danh mục "slop" S01–S21, kiểm bằng chứng E-NUM/E-SRC/E-CLAIM/E-PHI
//  • 2anh-studio (Lương Hải Anh, dựa trên PPT Master của Hugo He): quy tắc tiếng Việt, font đủ dấu,
//    sàn cỡ chữ, hỏi một lượt rồi mới làm, ô [CẦN BỔ SUNG: …] thay cho bịa
//  • frontend-slides (Zara Zhang): chọn phong cách bằng xem trước, vừa khung 16:9, chuyển động tiết chế
// Studio đóng gói sẵn toàn bộ tri thức này: người dùng không phải cài skill hay plugin nào.

export const DECK_TYPES = {
  "grand-rounds": "Grand rounds / sinh hoạt khoa học bệnh viện",
  "journal-club": "Journal club — phân tích một bài báo",
  "ca-lam-sang": "Ca lâm sàng",
  "mm": "M&M — bình bệnh, tử vong & biến chứng",
  "bai-giang": "Bài giảng (sinh viên / nội trú / CME)",
  "guideline": "Cập nhật khuyến cáo / guideline",
  "hoi-nghi": "Báo cáo hội nghị (nghiên cứu gốc)",
  "bao-ve": "Bảo vệ luận văn / luận án",
  "benh-nhan": "Giáo dục sức khỏe cho người bệnh / cộng đồng",
};

const RECIPES = `
CÔNG THỨC CỐT TRUYỆN (bỏ slide trong [ ] trước khi thiếu thời gian):
- journal-club (phản biện, 10–15'): Tiêu đề → Câu hỏi lâm sàng dạng PICO và vì sao quan trọng → Điều đã biết trước đó → Thiết kế (trial-schema) → Dòng bệnh nhân CONSORT (flow) → Đặc điểm nền ảnh hưởng khả năng áp dụng (table) → Kết cục chính, có hiệu quả tuyệt đối VÀ tương đối (bar-chart hoặc big-numbers) → Kết cục phụ & an toàn → [Phân nhóm, kèm thận trọng] → Thẩm định giá trị nội tại (RoB 2/CASP, table) → Áp dụng cho bệnh nhân của chúng ta → Kết luận + câu hỏi thảo luận.
- ca-lam-sang (10–15'): Tiêu đề → Bệnh cảnh (đã ẩn danh) → Khám & cận lâm sàng ban đầu → Chẩn đoán phân biệt (table hoặc two-col) → Cận lâm sàng then chốt (timeline) → Chẩn đoán → Điều trị & diễn tiến (timeline, ngày tương đối N0, N3) → Y văn: 2–3 điểm dạy học có bằng chứng → Thông điệp mang về.
- mm: Tóm tắt ca (timeline) → Điều đã xảy ra so với điều lẽ ra phải xảy ra (two-col) → Yếu tố góp phần (hệ thống, KHÔNG quy lỗi cá nhân) → Bằng chứng/khuyến cáo cho quy trình đúng (flow/decision) → Hành động đã thống nhất.
- bai-giang (30–45'): Tiêu đề → Mục tiêu học tập (2–4) → Ca mở đầu hoặc câu hỏi gợi mở (quiz) → Các khối khái niệm (mỗi khối: cơ chế/nguyên lý → hệ quả lâm sàng → câu hỏi kiểm tra) → Tóm tắt nhắc lại mục tiêu → Tài liệu tham khảo. Cứ 10–12 phút có một slide tóm tắt.
- guideline (15–20'): Tiêu đề → Khuyến cáo nào, so phiên bản nào, cách phân loại mức bằng chứng → Điều thay đổi (mỗi thay đổi lớn một slide: cũ vs mới, class/level, thử nghiệm đứng sau) → Điều không đổi nhưng hay bị áp dụng sai → Hàm ý cho bệnh viện của chúng ta → Bảng tóm tắt (recommendations).
- hoi-nghi (8–12'): Tiêu đề → Khoảng trống kiến thức → Mục tiêu/giả thuyết → Phương pháp (flow hoặc trial-schema) → Đối tượng → Kết quả chính → Kết quả phụ → [Phân tích độ nhạy] → Hạn chế → Kết luận & hàm ý → Lời cảm ơn & xung đột lợi ích.
- grand-rounds: theo công thức bài giảng, có một ca lâm sàng xuyên suốt.
- bao-ve: theo công thức hội nghị; nêu lại mục tiêu ở đầu và trả lời lần lượt từng mục tiêu ở cuối.
- benh-nhan: Tiêu đề thân thiện → Vấn đề sức khỏe là gì (ngôn ngữ đời thường) → Dấu hiệu cần chú ý → Khi nào phải đi khám ngay (statement) → Việc nên làm / không nên làm (two-col) → Thuốc & tái khám → Hỏi đáp. Câu ngắn, không thuật ngữ khó, chữ to.`;

const VISUAL_GRAMMAR = `
NGỮ PHÁP HÌNH ẢNH Y KHOA — chọn "layout" theo LOẠI BẰNG CHỨNG của slide:
- Thiết kế thử nghiệm → "trial-schema" (dân số → ngẫu nhiên hóa tỉ lệ → các nhánh → tiêu chí đánh giá). Không bao giờ là gạch đầu dòng.
- Dòng bệnh nhân (CONSORT/PRISMA), quy trình, cơ chế tuần tự → "flow". Số chỉ lấy từ nguồn; thiếu thì để [CẦN BỔ SUNG].
- Phác đồ / cây quyết định chẩn đoán-điều trị → "decision" (câu hỏi → nhánh có/không), trích nguồn khuyến cáo.
- So sánh tỉ lệ giữa các nhánh → "bar-chart" (một trục, có đơn vị, nhánh can thiệp role "int", nhánh chứng role "ctl").
- Hai–ba con số chủ chốt → "big-numbers" (không làm lưới thẻ KPI giống nhau).
- Diễn tiến ca bệnh, lịch dùng thuốc → "timeline" (ngày tương đối N0, N3 để bảo mật).
- Khuyến cáo → "recommendations" (khuyến cáo · class · level · nguồn; giữ nguyên lời khuyến cáo).
- Định nghĩa, tiêu chuẩn, đặc điểm nền, chẩn đoán phân biệt → "table" hoặc "two-col".
- Câu hỏi cho khán giả, kiểm tra nhanh → "quiz" (đáp án hiện khi bấm).
- Thông điệp mang về, câu hỏi thảo luận → "statement" (tối đa 3 ý).
- Chuyển chương → "section". Ý chỉ có thể nói bằng chữ → "bullets" (tối đa 5 ý, cần lý do vì sao không có hình).
Không để hai slide liền nhau cùng layout trừ khi là một chuỗi cố ý (mỗi thay đổi khuyến cáo một slide).`;

const SLOP_RULES = `
CẤM (dấu hiệu slide do máy làm — danh mục S01–S21 của grand-rounds):
- S01 nhãn nhỏ/viết hoa phía trên tiêu đề ("03 · KẾT QUẢ", "ĐIỂM NHẤN"); S13 số chương to "01, 02".
- S02 lời nhắc người trình bày trên slide ("Bấm tiếp…", "(hiệu ứng)") → đưa vào notes.
- S03 kể quy trình làm ("Hình gốc đã đổi màu", "Tạo bởi AI", "Vẽ lại cho rõ") → chỉ ghi nguồn gọn.
- S04 chữ giữ chỗ (Lorem, TODO, XX%) — riêng ô [CẦN BỔ SUNG: …] là hợp lệ khi thiếu dữ liệu.
- S05 hình/biểu đồ bịa: mọi số trên biểu đồ phải có trong claims.
- S07 lưới thẻ KPI, S08 "chip" trang trí, S09 icon mỗi gạch đầu dòng, S10 chữ gradient/phát sáng, S16 emoji.
- S14 chuỗi gạch ngang kiểu "Không chỉ X — mà là Y"; S15 sáo ngữ: "bước ngoặt", "cuộc cách mạng", "điểm nhấn", "khám phá", "đột phá", "game-changer", "Key takeaways".
- S17 tiêu đề chủ đề ("Kết quả", "Tổng quan") → phải là câu KHẲNG ĐỊNH kết luận của slide.
- S18 quá 40 chữ thân bài trên một slide nội dung → chuyển chi tiết sang notes hoặc tách slide.
- S20 giải thích điều hiển nhiên ("Như hình trên cho thấy").
- S21 cường điệu: "cải thiện rõ rệt sống còn" khi HR 0,77, p = 0,33 → dùng đúng độ mạnh của bằng chứng.`;

const EVIDENCE_RULES = `
NGUYÊN TẮC BẰNG CHỨNG (không bịa):
- Mọi con số trên slide (tỉ lệ, HR, OR, RR, KTC 95%, p, n, liều) PHẢI chép từ NGUỒN được cung cấp bên dưới, kèm trích nguyên văn 15–60 chữ chứa con số đó. Không lấy số từ trí nhớ.
- Không tự viết PMID, DOI, NCT. Chỉ tham chiếu nguồn bằng mã [id] có trong danh sách NGUỒN.
- Thiếu số liệu cần thiết → viết đúng dạng [CẦN BỔ SUNG: mô tả số cần] trên slide, không đoán.
- Không nói "cải thiện/giảm/vượt trội" khi KTC 95% chứa 1 (với tỉ số) hoặc p ≥ 0,05. Không dùng ngôn ngữ nhân quả cho nghiên cứu quan sát. Phân nhóm không trình bày như kết quả chính. Có hiệu quả tương đối thì kèm hiệu quả tuyệt đối trên slide chính nếu nguồn có.
- Phân biệt kết cục chính/phụ, ITT/per-protocol, phân tích giữa kỳ/cuối cùng. Giả định thiết kế (cỡ mẫu dự kiến) không phải kết quả.
- Ca lâm sàng: KHÔNG tên, chữ cái đầu kèm ngày, mã bệnh án, số điện thoại, địa chỉ, ngày tháng cụ thể (dùng N0, N3…). Chỉ ghi tuổi, giới, bệnh cảnh.`;

function vnRules(lang) {
  if (lang === "en") return `
NGÔN NGỮ: Toàn bộ chữ trên slide bằng tiếng Anh y khoa chuẩn; số thập phân dùng dấu chấm (0.58). Speaker notes có thể bằng tiếng Việt nếu người trình bày là người Việt.`;
  return `
NGÔN NGỮ & CHỮ VIỆT (quy tắc của 2anh-studio):
- Viết tiếng Việt chuẩn, đủ dấu, văn phong y khoa Việt Nam (theo cách gọi của Dược thư Quốc gia, Bộ Y tế). Tên thuốc dùng tên hoạt chất INN; tên thử nghiệm, thang điểm, chữ viết tắt quốc tế giữ nguyên (HR, KTC 95%, NNT, eGFR, NYHA).
- Lần đầu dùng thuật ngữ tiếng Anh khó thì kèm nghĩa tiếng Việt trong ngoặc.
- Số thập phân dùng dấu phẩy (0,58; 82,2%), hàng nghìn dùng dấu chấm (1.137). "KTC 95%" thay cho "95% CI".
- Không viết hoa toàn bộ câu; tiêu đề viết hoa chữ đầu câu.`;
}

export const DECK_SCHEMA = `
ĐỊNH DẠNG MỖI SLIDE (JSON). Trường chung: "layout", "title" (câu khẳng định, ≤ 16 chữ, riêng title/section/quiz có thể ngắn), "notes" (lời người trình bày nói, 40–120 chữ, có thể ghi "[bấm]" để báo hiệu), "refs" (mảng mã nguồn [id] dùng trên slide), "minutes" (số phút).
Các layout và trường riêng:
- "title": "title", "subtitle", "presenter", "affiliation", "event"
- "section": "title", "subtitle"
- "bullets": "points": ["≤ 5 ý, mỗi ý ≤ 14 chữ"]
- "two-col": "left": {"heading","points":[…]}, "right": {"heading","points":[…]}
- "big-numbers": "numbers": [{"value":"18,6%","label":"nhãn ngắn có đơn vị/kết cục","role":"int|ctl|neutral"}] (1–3 số), "caption": "một câu diễn giải"
- "table": "columns": ["…"], "rows": [["…","…"]] (≤ 7 hàng, ≤ 5 cột), "highlight": chỉ số cột cần nhấn (tùy chọn)
- "bar-chart": "unit": "%", "categories": ["kết cục 1","kết cục 2"], "series": [{"name":"Dapagliflozin","role":"int","values":[16.3, 9.6]},{"name":"Giả dược","role":"ctl","values":[21.2, 13.9]}], "caption": "" (values là SỐ, dấu chấm thập phân)
- "timeline": "events": [{"when":"N0","what":"≤ 6 chữ","detail":"≤ 14 chữ"}] (3–7 mốc)
- "flow": "steps": [{"label":"≤ 6 chữ","detail":"≤ 14 chữ"}] (3–6 bước)
- "decision": "question": "…?", "yes": {"label":"Có","outcome":"…"}, "no": {"label":"Không","outcome":"…"}, "note": ""
- "trial-schema": "population": "…", "randomization": "1:1, phân tầng theo …", "arms": [{"name":"…","detail":"liều, lịch","role":"int|ctl"}], "primary": "…", "secondary": ["…"]
- "recommendations": "items": [{"text":"nguyên văn khuyến cáo","class":"I","level":"A","source":"[id]"}]
- "quiz": "question": "…", "options": ["A …","B …","C …","D …"], "answer": 0, "explain": "giải thích ngắn"
- "statement": "points": ["1–3 câu thông điệp"]
- "references": tự sinh từ nguồn, chỉ cần {"layout":"references","title":"Tài liệu tham khảo"}`;

const JSON_TAIL = `
CHỈ TRẢ VỀ MỘT KHỐI JSON HỢP LỆ, không markdown, không giải thích ngoài JSON.`;

function briefBlock(p) {
  const b = p.brief || {};
  const lines = [
    `Chủ đề: ${b.topic || ""}`,
    `Loại bài: ${DECK_TYPES[b.deckType] || b.deckType || "chưa rõ"}`,
    `Khán giả: ${b.audience || "chưa rõ"}`,
    `Thời lượng: ${b.minutes || "?"} phút trình bày`,
    `Ngôn ngữ slide: ${b.lang === "en" ? "Tiếng Anh" : "Tiếng Việt"}`,
    `Người trình bày: ${[b.presenter, b.affiliation].filter(Boolean).join(" — ") || "[CẦN BỔ SUNG]"}`,
    b.event ? `Sự kiện: ${b.event}` : "",
    b.goal ? `Mục tiêu/thông điệp mong muốn: ${b.goal}` : "",
    b.extra ? `Yêu cầu thêm: ${b.extra}` : "",
  ].filter(Boolean);
  const qa = (p.questions || []).map((q) => {
    const a = p.answers?.[q.id];
    return a ? `- ${q.q} → ${a}` : "";
  }).filter(Boolean);
  if (qa.length) lines.push("Trả lời phỏng vấn:\n" + qa.join("\n"));
  return lines.join("\n");
}

export function slideBudget(minutes) {
  const m = Math.max(3, Math.min(90, +minutes || 15));
  return Math.max(4, Math.round(m * 0.9));
}

// 1) Phỏng vấn (deck-grilling): hỏi quyết định, không hỏi điều tra được
export function grillPrompt(p, sourceDigest) {
  return `Bạn là chuyên gia xây dựng bài trình bày y khoa cho bác sĩ Việt Nam. Trước khi lập dàn ý, hãy PHỎNG VẤN người trình bày MỘT LƯỢT để chốt các quyết định còn thiếu.

THÔNG TIN ĐÃ CÓ:
${briefBlock(p)}

${sourceDigest ? "TÓM TẮT NGUỒN ĐÃ CÓ (đọc trước khi hỏi, không hỏi điều đã có trong nguồn):\n" + sourceDigest.slice(0, 6000) : "Chưa có tài liệu nguồn."}

CÂY QUYẾT ĐỊNH (chỉ hỏi nhánh hợp với loại bài):
- Journal club: chỉ tường thuật hay phản biện? bảng kiểm nào (CASP, RoB 2, CONSORT, STROBE, PRISMA)? một bài hay kèm bối cảnh (thử nghiệm trước, khuyến cáo)? mấy câu hỏi thảo luận?
- Bài giảng: 2–4 mục tiêu học tập; kiến thức nền của người học; quan niệm sai cần sửa; có câu hỏi tương tác/quiz không?
- Guideline: khuyến cáo nào, phiên bản nào so với phiên bản nào; tập trung điều thay đổi hay toàn bộ; có hiển thị class/level; hàm ý cho bệnh viện?
- Ca lâm sàng / M&M: đã có đồng thuận & ẩn danh chưa; mức chi tiết dòng thời gian; 2–3 điểm dạy học; M&M theo hướng hệ thống, không quy lỗi.
- Hội nghị: giới hạn thời gian; người trình bày có phải tác giả; slide xung đột lợi ích.
- Giáo dục người bệnh: trình độ người nghe; thông điệp hành động duy nhất cần nhớ.
- Luôn chốt: thông điệp cốt lõi một câu; có cần tra PubMed bổ sung không.

QUY TẮC: tối đa 6 câu, mỗi câu có 2–4 lựa chọn ngắn và MỘT lựa chọn khuyến nghị kèm lý do một vế. Không hỏi điều đã biết ở trên. Viết bằng tiếng Việt.

Trả về JSON:
{"questions":[{"id":"q1","q":"câu hỏi","options":["…","…"],"recommended":"một trong options","why":"lý do ngắn"}],
 "pubmedQuery":"truy vấn PubMed tiếng Anh gợi ý (MeSH/từ khóa, có thể có AND/OR), rỗng nếu không cần",
 "coreMessageDraft":"bản nháp thông điệp cốt lõi một câu"}
${JSON_TAIL}`;
}

// 2) Dàn ý (deck-planning)
export function planPrompt(p, sourcesText) {
  const n = slideBudget(p.brief?.minutes);
  return `Bạn là chuyên gia lập dàn ý bài trình bày y khoa. Lập DÀN Ý (plan) — hợp đồng giữa người trình bày và người dựng slide.

${briefBlock(p)}

NGÂN SÁCH: khoảng ${n} slide nội dung cho ${p.brief?.minutes || 15} phút (≈ 1 slide/phút, chưa tính slide tiêu đề và tài liệu tham khảo).
${RECIPES}
${VISUAL_GRAMMAR}

PHƯƠNG PHÁP:
1. Viết thông điệp cốt lõi MỘT câu; slide nào không phục vụ nó thì bỏ.
2. Chọn công thức theo loại bài, co giãn theo ngân sách.
3. Tiêu đề mỗi slide là câu KHẲNG ĐỊNH kết luận của slide đó (vd "Dapagliflozin giảm 26% nguy cơ tử vong tim mạch hoặc nhập viện vì suy tim"), không phải chủ đề ("Kết quả"). Đọc liền các tiêu đề phải thành một câu chuyện.
4. Ghi "claimsNeeded": các số liệu/sự kiện slide cần, bằng lời (vd "HR kết cục chính với KTC 95%"). Nếu nguồn có số thì có thể ghi số kèm [id].
5. Slide đầu là "title", slide cuối là "references" nếu có nguồn. Journal club/guideline/hội nghị phải có slide hạn chế và điều còn chưa biết.
${vnRules(p.brief?.lang)}
${EVIDENCE_RULES}

NGUỒN:
${sourcesText || "(chưa có nguồn — mọi số liệu để [CẦN BỔ SUNG])"}

Trả về JSON:
{"coreMessage":"…","slides":[{"n":1,"layout":"title","title":"…","visual":"mô tả hình ảnh/bằng chứng","claimsNeeded":"…","notes":"ý chính người trình bày sẽ nói","minutes":0.5}],"openQuestions":["chỉ khi thật sự còn thiếu"]}
${JSON_TAIL}`;
}

// 3) Dựng slide (deck-builder + evidence-researcher gộp, có sổ cái claims)
export function buildPrompt(p, sourcesText, planSlides, allPlan) {
  const b = p.brief || {};
  return `Bạn là người dựng slide y khoa kiêm nghiên cứu viên bằng chứng. Dựng ĐÚNG các slide được giao theo dàn ý đã duyệt, kèm sổ cái số liệu (claims).

${briefBlock(p)}
Thông điệp cốt lõi: ${p.plan?.coreMessage || ""}

TOÀN BỘ DÀN Ý (để giữ mạch, KHÔNG dựng lại các slide khác):
${allPlan.map((s) => `${s.n}. [${s.layout}] ${s.title}`).join("\n")}

SLIDE CẦN DỰNG LẦN NÀY:
${JSON.stringify(planSlides, null, 1)}
${DECK_SCHEMA}
${VISUAL_GRAMMAR}
${SLOP_RULES}
${vnRules(b.lang)}
${EVIDENCE_RULES}

SÀN CỠ CHỮ (2anh-studio + grand-rounds): slide chiếu không chữ nào dưới 18 px ở 1920×1080, thân bài 28 px. Vì vậy phải CẮT CHỮ, không nhồi: thân bài ≤ 40 chữ/slide; bảng ≤ 7 hàng.
Slide "title": presenter="${b.presenter || "[CẦN BỔ SUNG: tên người trình bày]"}", affiliation="${b.affiliation || ""}", event="${b.event || ""}".

NGUỒN:
${sourcesText || "(không có nguồn — mọi số liệu ghi [CẦN BỔ SUNG: …])"}

Trả về JSON:
{"slides":[{ "n": số thứ tự theo dàn ý, "layout": "…", "title": "…", …trường riêng của layout…, "notes":"…", "refs":["id"] }],
 "claims":[{"slide": n, "text":"số liệu nói về gì (kết cục, dân số, thời điểm)", "values":["16,3%","HR 0,74","0,65–0,85"], "source":"id nguồn", "locator":"trang/bảng/hình hoặc mục Results", "quote":"trích NGUYÊN VĂN từ nguồn chứa các giá trị", "kind":"observed|planned|derived|recommendation|background", "status":"verified-fulltext|verified-abstract|unverified"}]}
${JSON_TAIL}`;
}

// 4) Sửa một slide theo yêu cầu
export function revisePrompt(p, slide, instruction, sourcesText) {
  return `Sửa MỘT slide y khoa theo yêu cầu của người trình bày, giữ đúng định dạng JSON của layout.

Yêu cầu sửa: ${instruction}

Slide hiện tại:
${JSON.stringify(slide, null, 1)}
${DECK_SCHEMA}
${SLOP_RULES}
${vnRules(p.brief?.lang)}
${EVIDENCE_RULES}

NGUỒN (chỉ lấy số từ đây):
${(sourcesText || "").slice(0, 40000) || "(không có)"}

Trả về JSON: {"slide":{…slide đã sửa…},"claims":[…claims cho các số mới, cùng định dạng như trước, có thể rỗng…]}
${JSON_TAIL}`;
}

// 5) Người phản biện bằng chứng (evidence-reviewer) — đọc slide đối chiếu nguồn
export function reviewPrompt(p, deck, sourcesText) {
  const slim = deck.slides.map((s, i) => ({ n: i + 1, ...s, notes: undefined }));
  return `Bạn là người PHẢN BIỆN BẰNG CHỨNG độc lập cho một bài trình bày y khoa. Bạn kiểm tra việc của người khác: câu hỏi không phải "nguồn có thật không" mà "nguồn có nói ĐÚNG điều này, về ĐÚNG kết cục này, ở ĐÚNG dân số này không".

SLIDE:
${JSON.stringify(slim, null, 1).slice(0, 60000)}

SỔ CÁI SỐ LIỆU:
${JSON.stringify(deck.claims || [], null, 1).slice(0, 30000)}

KIỂM TRA:
1. Giá trị, đơn vị, KTC, p, mẫu số có khớp nguồn không; đúng kết cục, dân số (ITT/PP/phân nhóm), thời điểm?
2. Lời trên slide: "cải thiện/giảm/vượt trội" khi KTC chứa 1 hoặc p ≥ 0,05; ngôn ngữ nhân quả từ nghiên cứu quan sát; phân nhóm trình bày như kết quả chính; chỉ có hiệu quả tương đối; kết cục thay thế trình bày như kết cục cứng; khuyến cáo bị diễn đạt mạnh hơn bản gốc; tiêu đề khẳng định quá mức bằng chứng.
3. Biểu đồ/sơ đồ chỉ dùng số có trong sổ cái.
4. Thông tin nhận dạng người bệnh.
${vnRules(p.brief?.lang)}

NGUỒN:
${(sourcesText || "").slice(0, 70000)}

Mã lỗi: E-NUM (số không khớp nguồn), E-SRC (không có nguồn hoặc nguồn không ủng hộ), E-REF (tài liệu sai), E-CLAIM (cường điệu/gây hiểu nhầm), E-FIG (hình không rõ nguồn), E-PHI (lộ danh tính).
Trả về JSON: {"findings":[{"code":"E-NUM","slide":7,"severity":"blocking|advisory","problem":"…","fix":"cách sửa cụ thể"}],"summary":"một câu"}
${JSON_TAIL}`;
}
