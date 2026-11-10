# Pre-processing UI — Phát

Hiện thực giao diện 3 vùng: navigation trái, scene center (placeholder rõ ràng cho đến khi Nga tích hợp), form xử lý phải và bảng phía dưới. Hiện chỉ có đường UI điền một ô Missing. Các phương pháp khác không giả vờ đã hoạt động.

## Contracts

- `selection`: `versionId + rowId + columnId` từ DatasetTable/scene. Chỉ chọn ô `null` trên current version để xử lý.
- `onPreview(config: FillCellConfig): Promise<PreviewResult>`: do Worker adapter cung cấp. Kết quả phải hợp `previewSchema`; không thay đổi Dataset khi preview.
- `onApply(preview): Promise<{ dataset: Dataset; persistedLocally: boolean }>`: do storage coordinator cung cấp; promise chỉ resolve khi đã commit dữ liệu, version/history/outbox nhất quán. Mọi lỗi reject; current dataset không đổi. `persistedLocally: true` là tín hiệu từ adapter, KHÔNG phải bằng chứng storage do UI tự kiểm chứng.
- `onApplied(dataset)` parent cập nhật current dataset và bỏ selection cũ.

## Bất biến an toàn

Đổi value/selection => hủy preview. Áp dụng bị khóa nếu preview không đúng `baseVersionId` và configuration, preview có lỗi, không có thay đổi hoặc chưa nối storage. Biểu đồ 3D chưa có => placeholder chứ không dùng ảnh/video giả 3D.

## Test cần làm khi nối

Preview không mutate current; thay đổi cấu hình vô hiệu Apply; reject từ IndexedDB không báo thành công, không chuyển trang; callback scene trả stable ID; onApply chỉ báo thành công sau commit.
