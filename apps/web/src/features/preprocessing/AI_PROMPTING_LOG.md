# AI Prompting Log — Pre-processing UI (Phát)

## 2026-11-08 — Lượt khởi tạo giao diện Missing

- **Prompt nguồn:** người dùng yêu cầu thực hiện thay phần việc được phân công trong repository và hướng dẫn từ số 0, từng bước.
- **Nguồn đối chiếu:** `docs/teamwork/phan-cong-thanh-vien.md` mục 3, `docs/prompt/prompt_tong_quan_chuc_nang_va_tuong_tac_3d.md` mục 2 và 6, `packages/contracts/src/index.ts`.
- **Mục tiêu đưa AI:** UI 3 vùng + bảng dưới; chọn ô theo stable IDs; Preview không commit; Apply chỉ sau commit local; không giả scene 3D/Worker/storage chưa có.
- **Code được tạo:** `PreprocessingPage.tsx`, `previewRules.ts`, `previewRules.test.ts`, `README.md`.
- **Đánh giá:** cú pháp đã được kiểm tra; chưa chạy typecheck/lint/unit/E2E thực tế vì npm registry không truy cập được.
- **Tồn đọng:** nối scene thật, các phương pháp Missing khác, preview Worker, storage coordinator, session state và E2E.
