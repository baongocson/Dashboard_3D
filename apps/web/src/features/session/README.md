# Session UI — Phát

Hiển thị RIÊNG local status và sync status, không nhập nhằng đã lưu máy và đã đồng bộ Atlas. Save và Exit là callback bất đồng bộ; nếu chưa nối storage thì nút bị khóa. Callback Exit phải hoàn tất commit rồi mới điều hướng, reject thì giữ nguyên trang. Không xử lý đăng xuất tại đây.

Các trạng thái cần nhận từ local storage: `not-connected`, `unsaved`, `saving`, `saved-local`, `failed`. Sync: `not-connected`, `offline`, `pending`, `syncing`, `synced`, `failed`.
