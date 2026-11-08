# Collection UI — Phát

## Trách nhiệm

Hiển thị file picker, cấu hình nhập CSV, trạng thái đang chạy/lỗi, tổng quan và bảng Dataset. Nút Next chỉ bật khi parent cung cấp Dataset hợp lệ từ Worker. CSV parsing và thống kê tính toán KHÔNG thuộc UI này.

## Public interface

- `CsvImportPanel`: `onImport(file: File, options: CsvOptions) => Promise<void>`; `status: ImportStatus`; tùy chọn `onCancel`.
- `CollectionPage`: `dataset: Dataset | null`; `onImport`, `importStatus`, `statistics`, `fileName`, `onNext`.
- `validateCsvInput`: kiểm tra đuôi `.csv`, số byte 1..20.000.000 và `csvOptionsSchema`; không đọc nội dung.
- `DatasetTable`: component chung; chọn ô bằng `versionId`, `rowId`, `columnId`.

## Tích hợp thật cần làm sau khi Worker sẵn sàng

1. Parent tạo `onImport` để gửi file/options cho Worker, nhận progress/errors, parse response bằng contracts.
2. Chỉ set `dataset` sau khi Worker hoàn tất và `datasetSchema.safeParse` thành công.
3. Nhận `statistics` thật từ engine. Không coi số lượng hiển thị ở fixture demo là số liệu của file thật.
4. Khi import đổi, clear selection, preview cũ. Next chỉ cho phép với Dataset hợp lệ.
5. Tăng cường table virtualization nếu hàng trăm nghìn dòng.

## Trạng thái và xử lý lỗi

File rỗng, đuôi sai, quá 20 MB đều báo lỗi trước parse. `onImport` không được nối thì nút Phân tích bị khóa. Không thông báo thành công khi chỉ chọn file.

## Kiểm thử cần có

- Unit: validation tệp/option.
- UI: chưa có dataset -> Next disabled, nút Import disabled khi chưa có Worker; lỗi import hiện đúng.
- Integration: worker thật trả progress/error/dataset và schema hợp lệ.
- E2E: từ file CSV thật -> Collection -> Next; chờ ghép task 04 và scene.

## Giới hạn

Không có parser, IQR, tương quan, outlier, lưu offline, sync trong phần này. Dữ liệu demo chỉ chạy tại `npm run dev` với `?demo=1`.
