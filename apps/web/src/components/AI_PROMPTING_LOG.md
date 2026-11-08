# AI Prompting Log — Shared DatasetTable (Phát)

## 2026-11-08 — Khởi tạo bảng dữ liệu

- **Prompt nguồn:** hướng dẫn và thực hiện phần frontend của Phát từ số 0.
- **Nguồn đối chiếu:** `packages/contracts/src/index.ts`, quy tắc selection trong `docs/prompt/prompt_tong_quan_chuc_nang_va_tuong_tac_3d.md`.
- **Đầu ra AI:** `DatasetTable.tsx`, có phân trang trong bộ nhớ, hiển thị null rõ, callback selection bằng version/row/column IDs; README.
- **Kiểm tra:** cú pháp TSX đã được kiểm tra; runtime browser/E2E chưa xác minh.
- **Chưa hoàn tất:** tối ưu virtualized table, test chọn ô trong browser và ghép scene 3D.
