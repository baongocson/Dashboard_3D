# AI Prompting Log — Dev demo fixture (Phát)

## 2026-11-08 — Tạo mẫu thử UI

- **Prompt nguồn:** yêu cầu minh họa và thực hiện nhiệm vụ frontend của Phát trong khi các module khác chưa được bàn giao.
- **Yêu cầu AI:** tạo Dataset đúng contracts để thực hành chọn ô và Preview, đồng thời không giả chức năng thật trong production.
- **Đầu ra:** `demoDataset.ts`, `demoPreview.ts`; chỉ dùng `?demo=1` khi Vite ở chế độ development; README.
- **Kiểm tra:** cú pháp; chưa chạy app do không truy cập được npm registry.
- **Giới hạn:** dữ liệu và preview mô phỏng không được tính là bằng chứng đã nhập CSV, có engine hay lưu local.
