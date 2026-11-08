# AI Prompting Log — Collection UI (Phát)

## 2026-11-08 — Lượt khởi tạo UI từ yêu cầu người dùng

- **Prompt gốc (ý chính, trích):** "bắt đầu từ phần 5 ... tôi không hiểu gì hết ... mục tiêu ... hoàn thành nhiệm vụ ... cứ cho là bạn thay tôi làm luôn đi ... step by step từng bước".
- **Tài liệu đầu vào:** `docs/teamwork/phan-cong-thanh-vien.md` mục 3; quy tắc Collection/CSV trong `docs/prompt/` và `docs/architecture/task-01-decisions.md`; schemas trong `packages/contracts/src/index.ts`.
- **Yêu cầu cho AI:** tạo UI nhập CSV có kiểm tra tệp, tùy chọn từ `csvOptionsSchema`, nhận progress/error, hiển thị Dataset/table/stats, Next có điều kiện; không tự viết parser hay báo thành công giả.
- **Code được tạo:** `CollectionPage.tsx`, `CsvImportPanel.tsx`, `csvInput.ts`, `csvInput.test.ts`, `README.md`.
- **Đánh giá kỹ thuật:** đã kiểm tra cú pháp TypeScript/TSX; chưa xác minh npm test/build/browser vì môi trường không cài được dependencies (npm registry EAI_AGAIN).
- **Hạn chế/tồn đọng:** Worker import, xác nhận duplicate/blank header, thống kê engine và kiểm thử integration còn thiếu.
- **Lần prompting tiếp theo:** ghi prompt thực tế, thay đổi, test expected/actual và quyết định vào file này; không tạo nhật ký khống.
