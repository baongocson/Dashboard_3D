# Đánh giá phần việc của Nguyên — Data Engine và Web Worker

## 1. Phạm vi đánh giá

- Ngày đánh giá: 10/11/2026, múi giờ Asia/Saigon.
- Nhánh: `codex/nguyen-data-engine-worker`.
- Commit được kiểm tra: `cf0b18a4edb5ff9e8a3b6a9bf0eb0f3af99ec1f6`.
- Nhánh có 2 commit mới so với nền tảng; thay đổi 53 file, thêm 4.278 dòng và xóa 3 dòng.
- Căn cứ: [Phân công chính, mục 8](../phan-cong-thanh-vien.md#8-nguyên--csv-thống-kê-missing-và-worker), [baseline nhiệm vụ 01](../../architecture/task-01-decisions.md) và `tests/fixtures/rules.ts`.
- Đã đọc diff, mã nguồn và báo cáo cá nhân; chạy kiểm tra trong bản sao riêng.

## 2. Kết luận

**Đã có engine và demo Worker chạy được, nhưng chưa hoàn thành phạm vi nhiệm vụ được giao và chưa nên merge nguyên trạng.**

Bộ kiểm tra hiện có đạt toàn bộ, nhưng các ca bổ sung đã phát hiện lỗi stale proposal, mất bản ghi CSV, suy luận dữ liệu chưa đúng baseline, mean không hữu hạn và thiếu runtime validation ở Worker. CSV, thống kê và Missing còn thiếu nhiều phần theo phân công; tích hợp Dashboard chưa hoàn thành.

## 3. Những phần đã làm được và mức đáp ứng

| Hạng mục        | Đã làm được                                                                                          | Phần còn thiếu theo baseline/phân công                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| CSV             | Parser, BOM/UTF-8, delimiter, header, missing token, kiểm tra dung lượng, tạo Dataset theo contracts | Sửa lỗi bảo toàn dữ liệu; import CSV chưa chạy qua Worker; tên cột tự sinh đang là `Column 1` thay vì `column_1` |
| Thống kê        | Tổng số dòng/cột/ô/missing; unique, min/max/mean theo cột                                            | Median/phân vị, độ lệch chuẩn, Pearson, IQR/outlier và duplicate theo baseline                                   |
| Missing         | Phát hiện missing; tạo và áp dụng proposal `constant`/`mean`                                         | Median/mode, nội suy, forward/back fill, phạm vi một ô và quy tắc tương ứng                                      |
| Preview         | Danh sách ô thiếu và proposal điền giá trị                                                           | Before/after theo contracts, `baseVersionId`, `configFingerprint`, chặn stale preview                            |
| Worker          | Summary, column statistics, missing detection; task ID; demo chunk/progress/cancel                   | CSV và Missing preview/apply chưa có tác vụ Worker; progress/cancel hiện chỉ gắn với `process-chunks` đếm dòng   |
| History         | Undo/redo snapshot trong bộ nhớ                                                                      | Chưa tích hợp version/history/outbox với storage; chưa phải undo lưu bền vững                                    |
| Browser factory | Có factory Worker và trang `worker-test.html`                                                        | Chưa nối vào Dashboard chính và kiểm chứng luồng đầu cuối                                                        |

Engine tái sử dụng Dataset/contracts và các hàm thuật toán chủ yếu là TypeScript thuần. Tuy nhiên, `tsconfig` của package đã thêm lib DOM để hỗ trợ Worker; cần rà lại ranh giới typecheck để engine thuần không vô tình phụ thuộc browser API.

## 4. Lỗi và vấn đề đã tái hiện

### NGUYEN-01 — P1: Proposal cũ vẫn áp dụng được lên phiên bản mới

- Vị trí: [applyMissingProposals.ts](https://github.com/baongocson/Dashboard_3D/blob/cf0b18a/packages/data-engine/src/missing/applyMissingProposals.ts#L11) và các kiểu proposal/preview.
- Cách tái hiện: tạo proposal mean từ `v1` có cột `[null, 2]`; sau đó áp dụng proposal đó lên `v2` có cùng row/column IDs nhưng dữ liệu `[null, 100]`.
- Actual: tạo `v3` với ô thiếu được điền **2**.
- Expected: từ chối proposal cũ; yêu cầu preview lại trên `v2`, khi đó mean phải là **100**.
- Nguyên nhân: proposal không gắn base version/config fingerprint; hàm apply chỉ kiểm tra ID, ô còn missing và new version khác current version.
- Hướng sửa: thống nhất preview contract với frontend/storage; gắn `baseVersionId` và `configFingerprint`, kiểm tra trước apply và publication.

### NGUYEN-02 — P1: CSV bỏ mất bản ghi có trường rỗng được quote

- Vị trí: [parseCsv.ts, hàm finishRecord](https://github.com/baongocson/Dashboard_3D/blob/cf0b18a/packages/data-engine/src/csv/parseCsv.ts#L47).
- Input: `a\n""\n`.
- Actual: parser chỉ trả header `a`; bản ghi `""` bị bỏ.
- Expected: giữ một bản ghi dữ liệu có ô missing. Đây là bản ghi có trường, khác với dòng hoàn toàn trống.
- Hướng sửa: theo dõi trạng thái bản ghi/trường đã xuất hiện trong nguồn, thay vì chỉ dựa vào chuỗi sau parse; bổ sung test CSV một cột có quoted empty field.

### NGUYEN-03 — P2: Suy luận CSV chưa bảo toàn dữ liệu và chưa đúng quy tắc ngày

- Vị trí: [inferColumnTypes.ts](https://github.com/baongocson/Dashboard_3D/blob/cf0b18a/packages/data-engine/src/csv/inferColumnTypes.ts#L11).
- Đã tái hiện: `001e0` bị chuyển thành số `1`; `1.0000000000000001` bị làm tròn thành số `1`.
- Ngày ISO `2026-11-10` tự được gán kiểu `date`, trong khi baseline yêu cầu ngày tháng giữ text lúc nhập.
- Hướng sửa: thống nhất kiểm tra bảo toàn dữ liệu khi chuyển số, giữ mã có số 0 đầu và giá trị mất chính xác dưới dạng text; bỏ suy luận date/datetime tự động ở bước CSV import.

### NGUYEN-04 — P2: Mean có thể trả Infinity từ đầu vào hữu hạn

- Vị trí: [getColumnStatistics.ts](https://github.com/baongocson/Dashboard_3D/blob/cf0b18a/packages/data-engine/src/stats/getColumnStatistics.ts#L52); cách tính tương tự có trong mean fill.
- Input thống kê: hai số `-1e308` và `1e308`.
- Actual: mean là `Infinity` do phép trừ trong cập nhật running mean bị tràn.
- Expected: mean bằng `0`, hoặc trả trạng thái lỗi/N/A có lý do khi thuật toán không thể tính an toàn; không trả số không hữu hạn.
- Hướng sửa: dùng cách tính ổn định phù hợp và kiểm tra hữu hạn ở đầu ra; thêm test giá trị lớn, trái dấu và mean fill.

### NGUYEN-05 — P2: Worker chưa validate thông điệp ở runtime

- Vị trí: [processWorkerRuntimeRequest.ts](https://github.com/baongocson/Dashboard_3D/blob/cf0b18a/packages/data-engine/src/worker/processWorkerRuntimeRequest.ts#L30) và Worker message handler.
- Cách tái hiện: gửi `dataset-summary` với dataset có version ID rỗng, row ID rỗng và không có cột hợp lệ.
- Actual: runtime trả `status: success` và kết quả summary.
- Expected: validate message/dataset từ `unknown`, trả lỗi có task ID khi input không hợp lệ.
- Hướng sửa: định nghĩa schema request/response dùng chung cho biên Worker; không chỉ dựa vào kiểu TypeScript của `MessageEvent`.

## 5. Kết quả kiểm tra đã chạy

| Kiểm tra                                  | Kết quả                  | Giới hạn                                                                       |
| ----------------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `npm run check`                           | Đạt                      | Gồm typecheck, lint, tests và build                                            |
| Bộ tests hiện có                          | 141 tests / 26 files đạt | Không chứng minh đủ baseline; các lỗi ở mục 4 chưa được bộ tests này phát hiện |
| Build web/API                             | Đạt                      | Dashboard chính chưa sử dụng engine/Worker mới                                 |
| Summary trên Chrome, trang Worker riêng   | Đạt                      | Dataset mẫu nhỏ                                                                |
| `process-chunks` 100.000 dòng trên Chrome | Đạt                      | Tác vụ duyệt/đếm dòng, chưa phải CSV parse hoặc thống kê chuyên sâu theo chunk |
| Cancel `process-chunks` trên Chrome       | Đạt                      | Không suy rộng thành mọi tác vụ đều hủy được                                   |
| Page errors trong các ca browser trên     | Không ghi nhận           | Chưa phải kiểm thử tích hợp toàn hệ thống                                      |
| Các ca bổ sung NGUYEN-01 đến NGUYEN-05    | Đã tái hiện              | Cần thêm thành kiểm thử hồi quy trong nhánh                                    |

Chưa kiểm chứng hiệu năng CSV gần 20 MB, ngân sách progress/cancel, tích hợp storage, stale preview trên UI hoặc luồng Apply/lưu/mở đầu cuối.

## 6. Đối chiếu báo cáo cá nhân

Báo cáo `docs/teamwork/nguyen.md` đã ghi rõ chưa tích hợp Dashboard và `process-chunks` mới đếm dòng. Kết quả 141 tests đạt đã được kiểm chứng lại.

Tuy nhiên, nhãn CSV và thống kê “Hoàn thành” cần điều chỉnh thành “Hoàn thành một phần theo phạm vi hiện có”, kèm danh sách baseline còn thiếu. Không dùng số lượng tests đạt để kết luận toàn bộ nhiệm vụ đã hoàn thành.

## 7. Thứ tự hoàn thiện đề xuất

1. Sửa NGUYEN-01 và NGUYEN-02 trước, vì có thể áp dụng kết quả cũ hoặc làm mất dòng dữ liệu.
2. Sửa suy luận CSV, tính mean và runtime validation; thêm test hồi quy cho các ca đã tái hiện.
3. Bổ sung các phương pháp thống kê/Missing còn thiếu theo baseline; đối chiếu fixtures chung.
4. Đưa CSV và preview Missing qua Worker; triển khai progress/cancel cho công việc thực tế, không chỉ đếm dòng.
5. Thống nhất preview/message contracts với Phát/Trâm, tích hợp UI/storage và kiểm tra luồng dữ liệu thật.
6. Cập nhật báo cáo bàn giao, phân biệt rõ đã triển khai, đã kiểm chứng và phần còn thiếu.

**Trạng thái đánh giá: Hoàn thành một phần; cần sửa và review lại trước khi merge.**
