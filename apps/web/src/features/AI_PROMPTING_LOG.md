# AI Prompting Log — phạm vi frontend của Phát

> Ghi chép trung thực. Những thao tác chưa được chạy trên máy Phát và những thử nghiệm chưa thể kiểm tra đều được đánh dấu chưa xác minh. Không dùng log này thay log cá nhân cho các lượt prompting phát sinh trong tương lai.

## 2026-11-08 — Tác vụ: khởi tạo UI milestone độc lập

- **Nguồn yêu cầu:** người dùng yêu cầu trợ lý hướng dẫn step-by-step và thực hiện phần việc Phát sau khi đã xem ZIP, tập trung riêng phạm vi `apps/web/src/features` và `apps/web/src/components`.
- **Phạm vi giao việc:** `docs/teamwork/phan-cong-thanh-vien.md`, mục 3 Phát. Tài liệu kèm theo: `docs/prompt/`, `docs/architecture/task-01-decisions.md`, `packages/contracts/src/index.ts`.
- **Mục tiêu AI:** xây giao diện Collection, CSV picker/options, bảng Dataset, Next, Pre-processing Missing/preview, trạng thái Save/Sync; không giả CSV parser, engine, 3D, DB khi dependency chưa có.
- **Thay đổi:** tạo UI components riêng, adapter callbacks có type, fixture demo chỉ ở development, README module và test pure helpers. Thay `apps/web/src/app/App.tsx`, `styles.css` và `vitest.config.ts` tại bản ZIP đang kiểm tra; cần review trước khi merge vì đó là file dùng chung.
- **Quyết định thiết kế:** `Next` chỉ bật khi có Dataset; `onImport` chưa nối thì vô hiệu; Preview phải khớp version/selection/value; Apply chỉ bật khi có `onApply` và callback chỉ được resolve sau commit local; không thông báo save/sync giả.
- **Giới hạn xác minh:** tại môi trường này `npm ci` bị chặn do lỗi DNS npm registry (EAI_AGAIN). Vì vậy chưa thể xác nhận `npm run check`, `npm run test:e2e` hoặc browser rendering; chỉ có thể kiểm tra cấu trúc và cú pháp bằng compiler cài đặt sẵn. Người thực hiện phải chạy lại trên máy.
- **Đầu ra:** bộ code thay đổi, checklist tích hợp và README; log này chỉ là tác vụ đầu, không phải toàn bộ lịch sử prompting của dự án.

## Nhật ký các lượt tiếp theo — mẫu

- Ngày/giờ:
- Module và file:
- Mục tiêu:
- Prompt đầu vào (nguyên văn hoặc link cuộc trao đổi):
- AI đề xuất/thực hiện:
- Kiểm tra thực tế (lệnh, expected, actual):
- Lỗi/phản biện và phiên sửa:
- Quyết định cuối và lý do:
