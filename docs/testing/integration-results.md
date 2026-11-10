# Nghiệm thu tích hợp Dashboard 3D

Ngày: **10/11/2026**, Asia/Saigon. Báo cáo này thay thế các mô tả “chưa tích hợp” trong báo cáo bàn giao lịch sử, không sửa lại kết luận review tại thời điểm cũ.

## Phạm vi

Đã merge sáu nhánh Nguyên, Phúc, Phát, Trâm, Nga, Tuấn vào nhánh tích hợp. Giải quyết conflict App bằng UI chung, thay prototype/parser riêng của Nga bằng scene dùng Dataset/selection chung; loại Node test sai runner, notebook checkpoints và nút demo storage. Tuấn chưa có backend nghiệp vụ khi bàn giao; project API/MongoDB publication và client sync được bổ sung trong đợt tích hợp này.

Các lỗi trong sáu báo cáo tại `docs/teamwork/evaluate` đã được đối chiếu: stale proposal, quoted-empty CSV, inference mất chính xác/ngày, mean tràn, runtime Worker validation, retry import, số fill bị làm tròn, publication thiếu chunk/hash/version, lỗi lint, reservation rate limit, CSRF idle, Unicode password và URI test rỗng. Có kiểm thử hồi quy tương ứng.

## Kết quả

Kết quả hồi quy đã ghi nhận (Node 24.15.0, npm 11.12.1, Windows, Chrome):

| Kiểm tra                                       | Kết quả                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| Typecheck, lint, build                         | Đạt                                                                     |
| Unit/API/storage                               | 234 tests; 5 integration tests chỉ chạy khi cấu hình Atlas              |
| Chrome production + API test server có nhãn    | 18/18 E2E đạt                                                           |
| Auth + publication/concurrency trên Atlas thật | 5/5 đạt                                                                 |
| UI production → Atlas → browser context mới    | 1/1 E2E đạt; dữ liệu sau Apply, lịch sử Undo và chart cũ được khôi phục |
| Format và diff whitespace                      | Đạt                                                                     |

Các ca đã xác nhận:

- TypeScript strict, lint và build web/API chạy được, không tắt quy tắc để bỏ qua lỗi.
- Unit/API/storage kiểm tra thuật toán theo fixture, publication transaction, thiếu chunk/hash/version, quota/abort và hai Apply đồng thời trên cùng base.
- Chrome production: CSV thật → Collection → Next → preview → Apply → stale chart chỉ đọc → Save/Exit/Open → Undo, offline reload và Apply offline; quota lỗi giữ current và retry được.
- Chrome: xác nhận header đề xuất; mean/median khác nhau theo cột; One-hot và Undo khôi phục cấu trúc; raycast thật chọn đúng dòng/ô; filter/selection/camera khôi phục; mất commit ACK rồi retry; browser context mới tải lại project từ server.
- Atlas thật: auth unique index/đăng ký đồng thời/password hash/session; chunk completeness, publication transaction, operation replay sau revision mới và conflict bảo toàn server. **5/5 integration tests đạt** sau khi IP máy được thêm Network Access. Không dùng kết quả memory test để khẳng định Atlas.
- `npm audit --omit=dev`: **0 vulnerabilities** tại lần kiểm tra.

## Hiệu năng đại diện

Fixture UTF-8 **19.899.967 byte**, **223.595 dòng**, 2 cột, một cột text lặp và một cột số hằng; xử lý và lưu toàn bộ khi offline trên Chrome.

| Lần đo                                                               | Tổng thời gian đến UI sẵn sàng/local saved | Nhịp animation frame lớn nhất |
| -------------------------------------------------------------------- | ------------------------------------------ | ----------------------------- |
| Trước tối ưu lưu import                                              | 14.624 ms                                  | 2.191 ms                      |
| Sau chuyển publication import vào Worker và tái dùng dataset đang mở | 13.835 ms                                  | 784 ms                        |

Vòng cuối chạy riêng sau khi check/build kết thúc: **13.823 ms tổng**, **726 ms nhịp UI lớn nhất**. Khi toàn bộ suite chạy đồng thời với check/build, đã ghi nhận 21.553–30.097 ms tổng và 822–940 ms nhịp UI; đây là lý do không xem một lần đo là cam kết hiệu năng.

Số liệu lấy từ `tests/e2e/performance.spec.ts`, test chạy đồng thời tối đa 2 workers. Đây là phép đo một cấu trúc dữ liệu trên môi trường hiện tại; không phải cam kết mọi CSV 20 MB đều có thời gian/RAM giống nhau. Chưa benchmark ma trận hàng nghìn cột hoặc One-hot sát ngân sách tài nguyên. Không đo/khẳng định số RAM trình duyệt.

## Chạy lại

```powershell
npm ci
npm run check
npm run format:check
npm run test:e2e
node --env-file=atlas-credentials.env --import tsx tests/support/run-atlas.ts
npm run test:e2e:atlas
```

`test:e2e` dùng API memory test server được ghi nhãn. `test:e2e:atlas` dùng entrypoint production, `.env` backend và Atlas thật; chạy riêng khi không có server chiếm cổng 4173/3001. Các test Atlas tạo username/owner/operation IDs riêng và dọn đúng fixture của lần chạy, không drop database chung. File secret và artifacts test-results không được commit.

## Giới hạn vận hành

App được nghiệm thu cho chạy local theo README; deployment HTTPS/proxy trên Internet chưa nằm trong lần chạy này. Chunk sync 1 MiB, metadata commit tối đa 4 MB; quá giới hạn/lỗi backend giữ outbox/local và báo lỗi. Scene giới hạn 1.500 đối tượng, bảng phân trang 20 dòng, One-hot có ngân sách 2.000.000 ô mới mỗi cột. Preview/Apply/recovery dữ liệu lớn vẫn có thể dùng nhiều RAM và có đoạn parse/validation phía UI; không tuyên bố toàn bộ pipeline là streaming/chunk-bounded.
