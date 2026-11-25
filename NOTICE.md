# Ghi công mã nguồn mở

MedSlide VI Studio gộp phương pháp và một phần mã của ba dự án theo giấy phép MIT (bản giấy phép gốc nằm trong `licenses/`):

| Dự án | Tác giả | Phần dùng trong Studio |
|---|---|---|
| [grand-rounds](https://github.com/drtranquanghung91-vn/grand-rounds) | Trần Quang Hưng | Lõi trình chiếu `deck-engine.html` (sân khấu 1920×1080, fragment, ghi chú, laser/khoanh/bút); cây câu hỏi phỏng vấn; công thức cốt truyện; ngữ pháp hình ảnh y khoa; sổ cái số liệu (claims); danh mục slop S01–S21; logic `phi_scan`, `check_claims`, `verify_refs`, `pubmed.py` (viết lại bằng Node.js) |
| [2anh-studio](https://github.com/luonghaianh1208/2anh-studio) | Lương Hải Anh (dựa trên PPT Master của Hugo He) | Quy tắc tiếng Việt cho AI, font Windows đủ dấu, sàn cỡ chữ, hỏi một lượt trước khi làm, ô `[CẦN BỔ SUNG: …]` thay cho bịa, nguyên tắc PowerPoint sửa được |
| [frontend-slides](https://github.com/zarazhangrui/frontend-slides) | Zara Zhang | Triết lý chọn phong cách bằng xem trước, preset có cá tính, vừa khung 16:9, chuyển động tiết chế |

Lõi kết nối AI CLI (`server/drivers.mjs`, `server/env-path.mjs`) kế thừa từ PDF Layout VI Studio của cùng tác giả.
