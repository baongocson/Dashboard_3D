# Shared UI components — Phát

`DatasetTable.tsx`: nhận một `Dataset` đã được kiểm tra ở boundary, hiển thị 20 dòng/trang theo mặc định và trả `CellSelection` chứa `versionId`, `rowId`, `columnId`. Không dùng thứ tự dòng làm danh tính. `null` hiển thị nhãn Thiếu, còn `0` giữ nguyên 0.

Phần này KHÔNG tính toán thống kê, không thay đổi data và không lưu dữ liệu. Để hỗ trợ dataset rất lớn, thay phân trang bộ nhớ bằng virtualized table trong giai đoạn tích hợp hiệu năng.
