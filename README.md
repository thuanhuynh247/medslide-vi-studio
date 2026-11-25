# MedSlide VI Studio

Ứng dụng Windows làm slide Y khoa bằng AI: hỏi trước, có bằng chứng PubMed, tự kiểm số liệu. Bạn không phải cài skill hay plugin nào: tri thức của ba dự án mã nguồn mở đã được đóng gói sẵn vào ứng dụng.

## Quy trình 8 bước
1. **Đề bài**: chủ đề, loại bài (grand rounds, journal club, ca lâm sàng, M&M, bài giảng, guideline, hội nghị, bảo vệ luận án, giáo dục người bệnh), khán giả, thời lượng, tài liệu nguồn (PDF/DOCX/TXT).
2. **Phỏng vấn**: AI hỏi một lượt tối đa 6 câu, câu nào cũng có sẵn lựa chọn khuyến nghị.
3. **Bằng chứng**: tra PubMed thật (NCBI E-utilities), lấy toàn văn từ Europe PMC, thêm bài theo PMID/DOI.
4. **Dàn ý**: tiêu đề khẳng định, số liệu cần có cho từng slide, thời lượng. Bạn duyệt xong thì mới dựng.
5. **Phong cách**: chọn bằng ảnh xem trước giữa 5 phong cách: Lâm sàng, Hội nghị tối, Học thuật, Bệnh viện, Cộng đồng.
6. **Slide**: 16 bố cục y khoa (sơ đồ thử nghiệm, CONSORT, cây quyết định, biểu đồ, dòng thời gian, khuyến cáo class/level, quiz…). Sửa tay hoặc nhờ AI sửa từng slide.
7. **Kiểm định**: tìm số không có nguồn, PMID/DOI sai, thông tin nhận dạng người bệnh, ô `[CẦN BỔ SUNG]` còn trống, và 21 dấu hiệu slide do máy làm. Có thêm một lượt AI phản biện độc lập.
8. **Xuất file**: PPTX sửa được (biểu đồ và bảng là đối tượng PowerPoint thật), PDF 16:9, HTML trình chiếu offline có laser, bút khoanh và ghi chú.

## Nền tảng AI
Ứng dụng chạy bằng AI bạn đã có trên máy: Claude Code CLI, OpenAI Codex CLI, Gemini CLI, Antigravity, Meta Muse, OpenCode, Copilot CLI, Qwen Code, Ollama (offline). Bạn cũng có thể dùng khóa Gemini API hoặc OpenRouter. Lõi kết nối kế thừa từ PDF Layout VI Studio.

## Build
```
npm ci
npm test
npm run build:win      # trên Windows: ra bộ cài NSIS và bản portable trong release/
```
Muốn có bản cài đặt, đẩy mã lên GitHub: workflow `.github/workflows/build-win.yml` sẽ build trên `windows-latest`. Gắn tag `v*` thì workflow tự tạo bản Release.

Dữ liệu dự án được lưu ở `Documents\MedSlide VI Studio\`. Cấu hình và khóa API nằm ở `%APPDATA%\MedSlide VI Studio\`.

Phần ghi công cho grand-rounds, 2anh-studio và frontend-slides (đều theo giấy phép MIT) nằm trong [NOTICE.md](NOTICE.md).

## Website
Thư mục `web/` là trang giới thiệu tĩnh, triển khai trên Vercel với Root Directory là `web`. Nút tải luôn trỏ tới bản phát hành mới nhất trên GitHub Releases (`MedSlide-VI-Studio-Setup-x64.exe`, `MedSlide-VI-Studio-Portable-x64.exe`). Đổi phiên bản trong `web/config.js`.
