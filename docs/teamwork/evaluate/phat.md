# Đánh giá phần việc của Phát — Frontend UI

## 1. Phạm vi đánh giá

- Ngày đánh giá: 10/11/2026, múi giờ Asia/Saigon.
- Nhánh: `codex/phat-frontend-ui`.
- Commit được kiểm tra: `4d74e340981671c3092d2cfd69125e955dc1e7ba`.
- Hai commit mới: `dd6bd13` (bộ khung UI) và `4d74e34` (E2E, báo cáo tiến độ).
- Thay đổi so với nền tảng chung: 29 file, thêm 1.272 dòng và xóa 150 dòng.
- Căn cứ: [Phân công chính, mục 3](../phan-cong-thanh-vien.md#3-phát--frontend-giao-diện), [baseline nhiệm vụ 01](../../architecture/task-01-decisions.md), mã nguồn và báo cáo `docs/teamwork/Phat.md` trên nhánh.
- Đã đọc thay đổi, chạy kiểm tra trong bản sao riêng và tái hiện các vấn đề bên dưới. Chưa merge, sửa hoặc push mã nguồn nhánh Phát.

## 2. Kết luận

**Đã hoàn thành một phần bộ khung giao diện có kiểm thử; chưa hoàn thành nhiệm vụ frontend theo phân công. Cần sửa các lỗi đã tái hiện và review lại trước khi merge.**

Collection, bảng dữ liệu, form Missing một ô, điều hướng mẫu và điều khiển phiên đã có cấu trúc component rõ ràng. UI sử dụng stable IDs và contracts, phân biệt dữ liệu mẫu, chưa kết nối và lưu thành công.

Tuy nhiên, `App` chưa cung cấp adapter CSV Worker, preview thật, storage Apply/Save/Exit, scene 3D hoặc backend. Production chưa đi được luồng nhập CSV → Next → preview → Apply → lưu/mở phiên. Báo cáo cá nhân cũng đã nêu rõ chưa hoàn thành tích hợp thực tế.

## 3. Những phần đã làm được

| Hạng mục                       | Bằng chứng                                                                                | Đánh giá                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Tách giao diện thành component | CollectionPage, CsvImportPanel, DatasetTable, PreprocessingPage, SessionControls          | Có cấu trúc để tiếp tục tích hợp                                         |
| Cấu hình nhập CSV              | Chọn file, delimiter, header, missing tokens; kiểm tra đuôi file, file rỗng và dung lượng | UI chạy được; chưa đọc/parse CSV thật                                    |
| Trạng thái nhập                | Props cho processing/error/progress/cancel; khóa chức năng khi thiếu adapter              | Có giao diện kết nối, chưa kiểm chứng Worker thật                        |
| Tổng quan và bảng              | Các ô thống kê, hiển thị missing, phân trang; selection gồm versionId/rowId/columnId      | Chạy được với dataset mẫu                                                |
| Điều hướng                     | Collection → Next → Pre-processing và quay lại                                            | Đã kiểm tra với fixture dev; Next production khóa khi chưa có dataset    |
| Missing một ô                  | Nhận selection, nhập giá trị, yêu cầu preview, hiển thị before/after và lỗi/cảnh báo      | Chạy được với preview demo                                               |
| Vô hiệu preview cũ             | Đổi giá trị/selection xóa preview; kiểm tra base version và configuration                 | Có logic và tests cho các ca này                                         |
| Apply                          | Có interface adapter và kiểm tra schema dataset, version mới, persistedLocally            | Chưa có adapter thật hoặc E2E commit thành công/thất bại                 |
| Session controls               | Tách local/sync status, chờ callback Save/Exit và hiển thị lỗi                            | Có bộ khung; `App` chưa truyền callback                                  |
| Demo                           | Chỉ bật khi Vite DEV và URL có `?demo=1`; có nhãn dữ liệu mẫu                             | Phạm vi demo được công bố rõ                                             |
| Responsive                     | CSS theo breakpoint, bảng cuộn ngang; smoke production có kiểm tra chiều rộng 390 px      | Có bằng chứng cho shell Collection, chưa chứng minh mọi màn hình/dataset |

## 4. Lỗi đã tái hiện cần sửa

### PHAT-01 — P2: Sửa cấu hình sau lỗi import nhưng không thử lại được

- Vị trí: [CsvImportPanel.tsx](https://github.com/baongocson/Dashboard_3D/blob/4d74e34/apps/web/src/features/collection/CsvImportPanel.tsx#L38), các handler delimiter/header và điều kiện disabled của nút submit.
- Cách kiểm tra: mount component trong trang thử riêng với `onImport` trả lỗi ở lần đầu; chọn CSV, bấm Phân tích dữ liệu; callback báo lỗi header trùng và hướng dẫn chọn tên cột tự sinh; đổi header sang `generated`.
- Actual trên Chrome: lỗi cũ vẫn hiện, nút Phân tích dữ liệu vẫn disabled, callback mới được gọi một lần. Người dùng không thể thử lại chỉ bằng cách sửa cấu hình.
- Nguyên nhân: lỗi callback được lưu chung vào state `error`; handler đổi header/delimiter không xóa hoặc cập nhật lỗi này; submit bị khóa khi `error !== null`.
- Expected: sửa cấu hình liên quan phải cho phép thử lại nếu file/options đã hợp lệ và không có job đang chạy. Lỗi tạm thời từ Worker cũng cần có đường thử lại rõ ràng.
- Hướng sửa: tách lỗi validation file/options với lỗi của lần import; revalidate khi file/options đổi, và cho phép retry lỗi tác vụ khi đầu vào hợp lệ.
- Giới hạn bằng chứng: đây là kiểm tra component với callback lỗi có kiểm soát, chưa phải lỗi phát sinh từ parser CSV hoặc Worker thật đã tích hợp.

### PHAT-02 — P2: Giá trị số bị làm tròn vẫn được chấp nhận để tạo cấu hình fill

- Vị trí: [previewRules.ts, parseFillValue](https://github.com/baongocson/Dashboard_3D/blob/4d74e34/apps/web/src/features/preprocessing/previewRules.ts#L9).
- Input: `parseFillValue('number', '9007199254740991.1')`.
- Actual: `{ valid: true, value: 9007199254740991 }`. Chuỗi nhập đã mất phần thập phân nhưng vẫn được coi là hợp lệ.
- Nguyên nhân: chuyển bằng `Number(raw)` trước, sau đó chỉ kiểm tra số hữu hạn và safe integer của kết quả đã làm tròn.
- Expected: không âm thầm dùng giá trị khác với giá trị nhập; từ chối trường hợp mất chính xác theo quy tắc dữ liệu của dự án hoặc yêu cầu người dùng xác nhận chính sách số đã thống nhất.
- Hướng sửa: thống nhất bộ kiểm tra/chuyển số với engine, phân biệt miền Number được hỗ trợ và trường hợp mất chính xác; bổ sung test với giá trị sát giới hạn safe integer và chuỗi thập phân dài.

## 5. Đối chiếu nhiệm vụ giao

| Yêu cầu                                             | Trạng thái            | Phần cần hoàn thiện                                                                    |
| --------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| Collection nhận dataset thật và hiển thị lỗi import | Một phần              | Props/component đã có; `App` chưa nối onImport, progress/cancel hoặc dataset từ Worker |
| Collection → Next với dữ liệu hợp lệ                | Đạt trong fixture dev | Cần kiểm chứng CSV thật và response được validate trước khi cập nhật state             |
| UI ↔ 3D đồng bộ stable selection                    | Chưa tích hợp         | Phối hợp Nga nối scene với selection chung; scene hiện là placeholder                  |
| Form Missing và preview qua Worker                  | Một phần              | Hiện mới fill-cell với preview demo; chưa có phương pháp Missing khác hoặc Worker thật |
| Apply preview còn hiệu lực và chờ storage commit    | Một phần bộ khung     | Có guard/callback; chưa nối Trâm/Nguyên, chưa kiểm chứng commit/rollback thật          |
| Phân biệt đang xử lý, lỗi, lưu local và sync        | Có biểu diễn UI       | Cần nối trạng thái thật; không chỉ truyền giá trị mô phỏng                             |
| Save/Exit/Open và phục hồi phiên                    | Chưa hoàn thành       | Save/Exit chưa có callback trong App; chưa có luồng Open và khôi phục phiên            |
| Auth/project/sync                                   | Chưa tích hợp         | Phối hợp Phúc/Tuấn khi API và contracts sẵn sàng                                       |
| Dữ liệu lớn                                         | Có phân trang cơ bản  | Chưa kiểm chứng CSV gần 20 MB, nhiều cột hoặc ngân sách hiệu năng                      |

Không quy việc tự viết parser, scene, backend hoặc storage cho Phát. Trách nhiệm frontend là thống nhất adapter và tích hợp các phần đó khi sẵn sàng, có trạng thái/lỗi đúng và bằng chứng kiểm thử luồng thật.

## 6. Kết quả kiểm tra đã chạy lại

| Kiểm tra                                           | Kết quả                   | Phạm vi                                                                             |
| -------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| `npm run check`                                    | Đạt                       | Typecheck, lint, unit/API và build                                                  |
| Unit/API                                           | 24/24 tests, 4 files đạt  | Gồm tests nền tảng và quy tắc UI bổ sung                                            |
| Build web/API                                      | Đạt                       | Build không chứng minh đã tích hợp Worker/storage                                   |
| `npm run test:e2e`                                 | 8/8 tests đạt trên Chrome | Production shell, validation chọn file, các trạng thái chưa kết nối và API liveness |
| E2E dev với cấu hình riêng của Phát                | 6/6 tests đạt trên Chrome | Selection và preview dùng fixture; thay value/selection hoặc hủy làm mất preview cũ |
| Thử lại sau lỗi import bằng component harness      | Không đạt                 | Đã tái hiện PHAT-01                                                                 |
| Chuyển giá trị số sát giới hạn bằng parseFillValue | Không đạt                 | Đã tái hiện PHAT-02                                                                 |

Lệnh E2E dev đã dùng:

```text
node node_modules/@playwright/test/cli.js test --config=tests/dev-e2e/playwright.phat-dev.config.mjs
```

Chưa chạy luồng CSV thật → Worker → 3D → preview → Apply → IndexedDB → reload/mở lại vì nhánh chưa tích hợp các adapter này. Chưa xác minh Atlas/sync, offline/PWA, chart phiên bản cũ hoặc hiệu năng dữ liệu lớn.

## 7. Đối chiếu báo cáo cá nhân

Báo cáo `docs/teamwork/Phat.md` mô tả đúng giới hạn chính: bộ khung UI đã có, chưa hoàn thành chức năng thực tế. Các số lượng kiểm tra 24 unit/API, 8 E2E production và 6 E2E dev đã được kiểm chứng lại.

Phần ghi chú cuối báo cáo còn nói tests/báo cáo đang chuẩn bị commit/push; tại commit được review, các file này đã có trên GitHub. Cần cập nhật ghi chú để phản ánh đúng trạng thái bàn giao.

## 8. Thứ tự hoàn thiện đề xuất

1. Sửa PHAT-01 và PHAT-02, bổ sung test hồi quy cho retry và chuyển số.
2. Thống nhất adapter với Nguyên: nhập file/options, nhận progress/error/cancel/dataset; validate response trước khi dùng.
3. Ghép CSV thật → Collection → Next; kiểm tra thay file/cấu hình và kết quả job cũ không cập nhật nhầm UI.
4. Phối hợp Nga nối scene và bảng bằng stable IDs; kiểm tra selection và chart phiên bản cũ.
5. Thống nhất preview contract, nối engine và storage; kiểm tra lỗi commit không đổi dataset, không báo đã lưu và không thoát phiên.
6. Nối Save/Exit/Open và trạng thái local/sync thật; bổ sung E2E lưu/mở/reload và kiểm tra dữ liệu lớn phù hợp.
7. Cập nhật báo cáo bàn giao theo commit và phạm vi tích hợp đã kiểm chứng.

**Trạng thái đánh giá: Hoàn thành một phần bộ khung UI; chưa đạt nghiệm thu nhiệm vụ frontend đầy đủ.**
