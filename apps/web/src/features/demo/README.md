# Demo UI — development only

Chỉ bật ở `http://localhost:4173/?demo=1` khi `import.meta.env.DEV === true`. Fixture Dataset đã kiểm tra `datasetSchema`, thống kê mẫu được ghi rõ, Preview là mô phỏng UI không dùng Worker. Không có Apply, Save, sync, CSV import thật. Bản production không cho phép hiển thị fixture này bằng query param.

Không dùng màn hình demo làm bằng chứng đã hoàn tất thuật toán, lưu local hoặc hoạt động offline.
