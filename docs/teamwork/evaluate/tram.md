# Đánh giá phần việc của Trâm — Database và Local Storage

## 1. Phạm vi đánh giá

- Ngày đánh giá: 10/11/2026, múi giờ Asia/Saigon.
- Nhánh: `codex/tram-database-storage`.
- Commit được kiểm tra: `e973303ed9550f932ce5872f1f8a44be4f3a04c7`.
- Thay đổi so với nền tảng chung: 24 file, thêm 3.323 dòng và xóa 2 dòng.
- Căn cứ phân công: [Phân công chính, mục 7](../phan-cong-thanh-vien.md#7-trâm--database-mongodb-và-storage-indexeddb).
- Đã đọc diff, mã nguồn, tài liệu thiết kế và chạy kiểm tra trong bản sao riêng.

## 2. Kết luận

**Đã có nền tảng storage local chạy được, nhưng chưa hoàn thành toàn bộ nhiệm vụ và chưa nên merge nguyên trạng.**

Điểm chặn quan trọng nhất: publication vẫn có thể công bố phiên bản thiếu chunk, làm current pointer trỏ sang dữ liệu không đọc lại được. Ngoài ra, nhánh chưa qua lint và chưa có kiểm thử tự động riêng cho các tình huống lỗi storage.

## 3. Những phần đã làm được

| Hạng mục            | Bằng chứng trong nhánh                                                                                          | Đánh giá                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Thiết kế database   | `docs/architecture/database-structure.md` mô tả thực thể, quan hệ, index, publication, recovery và outbox       | Có bản thiết kế; cuối tài liệu vẫn ghi là đề xuất cần thống nhất với Phúc/Tuấn |
| IndexedDB           | Dexie; các bảng project, session, dataset, version, manifest, chunk, chart, history, outbox                     | Có triển khai nền tảng                                                         |
| Chunk và checksum   | `saveDatasetChunks`, `readDatasetChunks`; chia chunk, SHA-256, kiểm tra số lượng/thứ tự/kích thước/hash khi đọc | Chạy được với dữ liệu thử                                                      |
| Publication         | Ghi version/history/outbox/current pointer trong cùng transaction; kiểm tra project/dataset và base version     | Đúng hướng về transaction, còn thiếu xác minh nội dung trước công bố           |
| Recovery            | Đọc session/version/manifest, ghép và xác minh chunk, kiểm tra version ID của dataset                           | Khôi phục dữ liệu hợp lệ đã chạy được                                          |
| Project/session API | Có hàm lưu, đọc, truy vấn và xóa project/session                                                                | Có API bước đầu                                                                |
| Outbox local        | Có chuyển trạng thái và lọc thao tác theo dependency                                                            | Có nền tảng local; chưa chứng minh tích hợp sync/ACK thật                      |
| Demo                | Có nút thử chunk/publication/recovery trên giao diện                                                            | Demo dữ liệu mẫu chạy được; chưa thay thế luồng nghiệp vụ thật                 |

## 4. Lỗi và vấn đề cần sửa

### TRAM-01 — P1: Publication chấp nhận phiên bản thiếu dữ liệu

- Vị trí: [publication_service..ts, dòng 62–79](https://github.com/baongocson/Dashboard_3D/blob/e973303/apps/web/src/storage/services/publication_service..ts#L62).
- Hiện tại: `publishApply` chỉ kiểm tra manifest tồn tại và khớp metadata, rồi ghi version/history/outbox/session. Không kiểm tra chunk thực tế trước khi công bố.
- Cách tái hiện trên Chrome: lưu dữ liệu mới thành chunk → xóa các chunk của manifest mới → gọi `publishApply` với publication hợp lệ về schema.
- Actual: hàm trả thành công; `currentVersionId` chuyển sang phiên bản mới. Đọc lại báo `Số lượng chunk không khớp manifest`.
- Expected: từ chối publication, giữ nguyên current pointer và không công bố version/history/outbox của thao tác lỗi.
- Hướng sửa: xác minh chunk tồn tại, kích thước, hash và nội dung/version trước publication; thiết kế ranh giới kiểm tra/công bố để dữ liệu đã xác minh không bị thay đổi hoặc xóa trước khi công bố.
- Kiểm tra cần bổ sung: thiếu chunk, sai hash, sai nội dung/version; lỗi phải giữ commit cũ và không tạo publication một phần.

### TRAM-02 — P2: Chưa qua lint bắt buộc

- `npm run check` dừng ở lint với **11 lỗi**.
- Có lỗi kiểu trong template string, Promise handler của nút kiểm thử, kiểu catch callback và parsing file `.ipynb_checkpoints`.
- Cần sửa lỗi theo cấu hình hiện có, loại các checkpoint tự sinh khỏi thay đổi và ngăn chúng được commit lại.
- Tên `publication_service..ts` có hai dấu chấm; nên đổi thành tên chuẩn và cập nhật import để dễ bảo trì.

## 5. Phần chưa hoàn thành hoặc chưa có bằng chứng nghiệm thu

| Yêu cầu theo phân công                                     | Hiện trạng                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| MongoDB plugin/config và environment validation            | Nhánh không bổ sung mã backend cho phần này; hiện mới có mô tả thiết kế                                 |
| Index quan trọng được triển khai và kiểm chứng             | Có index đề xuất trong tài liệu, chưa có bằng chứng tạo/kiểm chứng index MongoDB trong nhánh            |
| Luồng import ban đầu nhất quán                             | Demo tự ghi project/session/version gốc; chưa có API import hoàn chỉnh ngoài demo                       |
| API storage để frontend/engine tích hợp                    | Có các hàm riêng; chưa kiểm chứng tích hợp với Phát/Nguyên, chưa có API chart riêng                     |
| Khôi phục đầy đủ trạng thái phiên/chart                    | Recovery đã kiểm tra dataset hợp lệ; chưa chứng minh đầy đủ camera/chart/trạng thái UI trong luồng thật |
| Quota, lỗi ghi, transaction abort và đóng tab giữa lúc ghi | Chưa kiểm chứng trong lượt review này; nhánh chưa bổ sung test storage tự động cho các ca này           |
| Sync/ACK thật và xử lý khởi động lại                       | Có outbox local; demo mô phỏng chuyển `synced`, chưa có server ACK thật                                 |

MongoDB và sync cần phối hợp với Phúc/Tuấn theo phân công. Không quy toàn bộ phần adapter nghiệp vụ của hai thành viên đó cho Trâm.

## 6. Kết quả kiểm tra đã chạy

| Kiểm tra                                                       | Kết quả             | Giới hạn                                                    |
| -------------------------------------------------------------- | ------------------- | ----------------------------------------------------------- |
| Typecheck                                                      | Đạt                 | Áp dụng mã tại commit được review                           |
| Lint                                                           | Không đạt, 11 lỗi   | Làm `npm run check` thất bại                                |
| Unit/API tests chạy riêng                                      | 16 tests đạt        | Các test nền tảng cũ, chưa chứng minh storage               |
| Build web/API chạy riêng                                       | Đạt                 | Build thành công không chứng minh tính đúng của publication |
| Demo chunk → publication → recovery trên Chrome                | Đạt với dữ liệu mẫu | Outbox sync trong demo là mô phỏng                          |
| Dữ liệu khoảng 5 MiB, 6 chunk; recovery sau reload trên Chrome | Đạt                 | Không phải benchmark hoặc kiểm thử CSV gần giới hạn 20 MB   |
| Publication khi chunk đã bị xóa                                | Không đạt           | Đã tái hiện TRAM-01                                         |

Không kết luận Atlas, offline/PWA, quota hoặc toàn bộ luồng sản phẩm đã đạt từ các kết quả này.

## 7. Thứ tự hoàn thiện đề xuất

1. Sửa TRAM-01 và thêm kiểm thử hồi quy cho dữ liệu thiếu/hỏng trước publication.
2. Kiểm tra abort/quota/lỗi ghi và xác nhận commit cũ được giữ nguyên.
3. Sửa lint, bỏ checkpoint tự sinh và chuẩn hóa tên file.
4. Thống nhất API import/apply/session/chart với Phát và Nguyên; kiểm tra lưu/mở trên luồng tích hợp.
5. Phối hợp Phúc/Tuấn hoàn thiện MongoDB config/index và giao thức outbox/ACK, ghi rõ phạm vi mỗi người đã kiểm chứng.

**Trạng thái đánh giá: Hoàn thành một phần; cần sửa và review lại trước khi merge.**
