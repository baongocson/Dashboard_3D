# Đánh giá phần việc của Phúc — Backend tài khoản và quyền truy cập

## 1. Phạm vi đánh giá

- Ngày đánh giá: 10/11/2026, múi giờ Asia/Saigon.
- Nhánh: `codex/phuc-backend-auth`.
- Commit được kiểm tra: `edae04f0bcd754e1546d1aee07a0b7f6caddcd01`.
- Nhánh có 6 commit mới so với nền tảng; thay đổi 28 file, thêm 2.402 dòng và xóa 21 dòng.
- Căn cứ: [Phân công chính, mục 5](../phan-cong-thanh-vien.md#5-phúc--backend-tài-khoản-và-quyền-truy-cập), [baseline nhiệm vụ 01](../../architecture/task-01-decisions.md), `auth-contract.md`, `auth-results.md` và báo cáo `Phuc.md` trên nhánh.
- Đã đọc diff, mã nguồn và tài liệu; chạy kiểm tra trong bản sao riêng. Chưa merge hoặc sửa mã nguồn của Phúc.
- Không đọc credential, kết nối hoặc ghi dữ liệu Atlas trong lượt review. Các ca bổ sung dùng repository bộ nhớ có nhãn TEST DOUBLE và chi phí scrypt giảm; không phải kiểm chứng MongoDB hoặc đo tải production.

## 2. Kết luận

**Đã triển khai phần lớn backend auth độc lập và có bộ kiểm thử rõ phạm vi. Chưa hoàn thành nghiệm thu nhiệm vụ theo phân công; cần sửa các lỗi đã tái hiện và review lại trước khi merge nguyên trạng.**

Đã có đăng ký, đăng nhập, phiên server-side, cookie, Origin/CORS/CSRF, rate limiter, ownership helper và adapter MongoDB với index. Tests hiện có chạy đạt; báo cáo trước của Phúc ghi nhận đã kiểm chứng MongoDB local và Atlas.

Tuy nhiên, review bổ sung phát hiện limiter chưa kiểm soát tốt các lần đăng nhập đồng thời, mutation bị từ chối vì CSRF vẫn gia hạn phiên, và đầu vào mật khẩu Unicode lỗi có thể làm hai chuỗi khác nhau xác thực như nhau. Contract còn chờ nhóm chốt; ownership trên API project thật và logout gắn với local/sync chưa được tích hợp.

## 3. Những phần đã làm được

| Hạng mục                   | Bằng chứng trong nhánh                                                                                            | Đánh giá                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Contracts tài khoản        | Schema register/login/profile/public user/session/error; chuẩn hóa username, quy tắc độ dài mật khẩu              | Có bản nháp dùng chung, còn 5 điểm chờ nhóm chốt                                   |
| Đăng ký                    | Chỉ username/password; response không có password hash; không tự tạo phiên/cookie                                 | Có triển khai và tests                                                             |
| Đăng nhập                  | Kiểm tra mật khẩu; tạo token ngẫu nhiên, phiên server-side và CSRF token; thu hồi cookie session cũ khi login mới | Có triển khai và tests                                                             |
| Băm mật khẩu               | Node scrypt, salt riêng; mặc định N=131072, r=8, p=1; lưu tham số trong hash                                      | Có tests với cost giảm và một test dùng cost mặc định                              |
| Lưu phiên                  | Token trong cookie, DB lưu HMAC; idle 24 giờ, tuyệt đối 7 ngày; đồng hồ server                                    | Có kiểm tra hạn trong code và tests                                                |
| Cookie và bảo vệ request   | HttpOnly, SameSite=Lax, Secure theo cấu hình; Origin allowlist, CORS credentials, CSRF cho mutation đã xác thực   | Có triển khai; thứ tự gia hạn/CSRF cần sửa                                         |
| Rate limit                 | Theo IP+username và IP; Retry-After; giới hạn theo cửa sổ                                                         | Chặn tuần tự đã có test; cần sửa trường hợp đồng thời                              |
| Ownership                  | requireAuth, requireUserId, requireOwned; tài nguyên không thuộc user trả 404                                     | Có helper và route mẫu trong tests, chưa phải project/dataset API thật             |
| MongoDB                    | User/session repositories, unique username/token hash, userId index, TTL absolute expiry                          | Có mã tạo index và integration tests; chưa chạy lại database thật trong review này |
| Khi database chưa sẵn sàng | Unavailable stores trả lỗi 503, không tạo tài khoản bộ nhớ làm fallback production                                | Có triển khai và tests                                                             |
| Xử lý lỗi dùng chung       | ApiError, validation error, phân loại lỗi MongoDB và redaction một số trường nhạy cảm                             | Có triển khai và tests                                                             |
| Tài liệu bàn giao          | Contract, ma trận lỗi, ownership example, báo cáo kết quả và phần chưa xác minh                                   | Khá rõ phạm vi; có ghi chú Git cũ cần cập nhật                                     |

## 4. Vấn đề đã tái hiện cần sửa

### PHUC-01 — P2: Nhiều lần đăng nhập đồng thời vượt ngưỡng kiểm tra mật khẩu

- Vị trí: [auth.service.ts, dòng 112–126](https://github.com/baongocson/Dashboard_3D/blob/edae04f/apps/api/src/modules/auth/auth.service.ts#L112) và `login-rate-limiter.ts`.
- Hiện tại: kiểm tra bộ đếm trước khi await tìm user và verify mật khẩu; chỉ ghi nhận thất bại sau khi verify xong. Chưa giữ chỗ cho request đang xử lý.
- Cách tái hiện: gửi đồng thời 12 request login sai cho cùng username và cùng IP bằng `app.inject`, với limiter mặc định 5 lần thất bại/15 phút theo IP+username.
- Actual: cả 12 request đều đi qua verify và trả 401; request tiếp theo mới trả 429.
- Tác động: ngưỡng đang chặn các request đến sau khi thất bại đã được ghi nhận, chưa chặn một đợt đoán mật khẩu đồng thời vượt ngưỡng. Các request này cũng đều có thể đi tới bước scrypt tốn tài nguyên.
- Expected: có cơ chế tính request đang xử lý hoặc giới hạn admission/concurrency trước verify, để một đợt đồng thời không bỏ qua mục tiêu throttling.
- Hướng sửa: chốt cách tính attempt/in-flight theo IP+username và IP; đặt giữ chỗ trước await, giải phóng/cập nhật theo kết quả; bổ sung test đồng thời. Rate limiter bộ nhớ một tiến trình là phạm vi hiện tại, không tự suy rộng sang nhiều instance.

### PHUC-02 — P2: Mutation bị từ chối CSRF vẫn gia hạn idle session

- Vị trí: [auth.module.ts, dòng 98–106](https://github.com/baongocson/Dashboard_3D/blob/edae04f/apps/api/src/modules/auth/auth.module.ts#L98) và [auth.service.ts, dòng 172–175](https://github.com/baongocson/Dashboard_3D/blob/edae04f/apps/api/src/modules/auth/auth.service.ts#L172).
- Hiện tại: requireAuth gọi `authenticate(..., extend)` và ghi gia hạn trước khi kiểm tra CSRF.
- Cách tái hiện: đăng nhập; tiến đồng hồ test thêm 23 giờ; gửi PATCH `/users/me` với cookie hợp lệ, Origin hợp lệ nhưng thiếu CSRF; sau đó probe bằng `x-session-activity: background` để không tự gia hạn thêm.
- Actual: PATCH trả 403 `CSRF_INVALID`, nhưng idle expiry vẫn tăng từ `2026-11-11T00:16:00.000Z` lên `2026-11-11T23:16:00.000Z`.
- Expected: mutation không qua bảo vệ request không được tính là hoạt động hợp lệ để gia hạn phiên. Nhóm cần ghi rõ quy tắc này trong contract hoạt động phiên.
- Hướng sửa: tách xác thực phiên và ghi nhận activity; chỉ touch sau khi CSRF và các điều kiện bảo vệ liên quan đã đạt. Bổ sung test xác nhận request bị từ chối không đổi idle expiry.

### PHUC-03 — P2: Mật khẩu chứa Unicode không hợp lệ có thể xác thực bằng chuỗi khác

- Vị trí: [passwordSchema trong contracts](https://github.com/baongocson/Dashboard_3D/blob/edae04f/packages/contracts/src/index.ts#L309), `loginRequestSchema` và [password.ts](https://github.com/baongocson/Dashboard_3D/blob/edae04f/apps/api/src/modules/auth/password.ts#L17).
- Cách tái hiện qua API: đăng ký password là `"\uD800".repeat(15)`; đăng nhập bằng `"\uD801".repeat(15)`. Đây là hai chuỗi chứa lone surrogate khác nhau, không phải Unicode well-formed.
- Actual: đăng ký trả 201 và login bằng chuỗi khác trả 200.
- Nguyên nhân: schema chỉ kiểm tra độ dài; khi string được chuyển sang byte cho scrypt, các surrogate lỗi được thay bằng ký tự replacement, làm hai chuỗi đầu vào khác nhau thành cùng byte sequence.
- Expected: từ chối Unicode không hợp lệ ở biên request, hoặc có chính sách biểu diễn mật khẩu đảm bảo tính nhất quán và được chốt rõ. Không âm thầm coi hai chuỗi đầu vào khác nhau là cùng mật khẩu.
- Hướng sửa: kiểm tra string well-formed khi đăng ký và đăng nhập; giữ nguyên quy tắc không trim/case-fold/normalize đối với mật khẩu Unicode hợp lệ. Bổ sung test lone surrogate bên cạnh emoji và NFC/NFD hiện có.
- Giới hạn: lỗi này áp dụng đầu vào Unicode lỗi có thể gửi qua JSON; không có bằng chứng từ ca này rằng hai mật khẩu Unicode hợp lệ thông thường bị trùng.

### PHUC-04 — P3: Biến URI integration rỗng làm lỗi collection dù suite định skip

- Vị trí: `apps/api/src/modules/auth/mongo.integration.test.ts`, phần khởi tạo MongoClient trong callback của `describe.skipIf(!uri)`.
- Khi `MONGODB_TEST_URI` hoàn toàn không tồn tại: suite skip đúng.
- Khi biến tồn tại với chuỗi rỗng: điều kiện định skip, nhưng callback vẫn khởi tạo `new MongoClient('')` do dùng `uri ?? fallback`; phát sinh MongoParseError ngay khi collection tests.
- Đã quan sát: 61 tests đạt nhưng suite Mongo lỗi; sau khi xóa hẳn biến môi trường, `npm run check` đạt với 3 tests skip.
- Hướng sửa: chuẩn hóa cấu hình URI test rỗng thành không cấu hình trước khi khởi tạo client, hoặc hoãn tạo client tới hook của suite thực sự chạy. Không in URI/credential khi báo lỗi.

## 5. Đối chiếu nhiệm vụ phân công

| Yêu cầu                                            | Đánh giá hiện tại                  | Điều kiện còn lại                                                                       |
| -------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| Chốt schema/request/response và cấu hình tài khoản | Đã có bản nháp đầy đủ              | Cần Phát/Tuấn/Trâm xác nhận các điểm còn mở; chưa coi là đã chốt chỉ vì code đã có      |
| Unique username chống đăng ký trùng đồng thời      | Có index, adapter và tests         | Review này xác minh lại test bộ nhớ; bằng chứng MongoDB/Atlas là báo cáo trước của Phúc |
| Băm mật khẩu, không trả mật khẩu/hash              | Đã triển khai                      | Sửa PHUC-03, giữ kiểm thử exact password cho Unicode hợp lệ                             |
| Đăng ký không tự đăng nhập, login tạo phiên thật   | Server đã triển khai               | Chưa có UI chuyển đăng nhập/luồng browser auth đầu cuối                                 |
| Cookie/session/CSRF/Origin/CORS/rate limit         | Đã triển khai phần lớn             | Sửa PHUC-01/02, chốt activity contract                                                  |
| Giao diện xác thực/ownership cho Tuấn              | Đã có helper và ví dụ              | Kiểm chứng trên project/dataset API thật sau tích hợp                                   |
| Logout và local/sync                               | Server thu hồi phiên và idempotent | Chính sách offline/pending outbox/xóa local là phần phối hợp client, chưa tích hợp      |
| MongoDB wiring                                     | Có đoạn nối tạm trong server.ts    | Phối hợp Trâm thay bằng plugin/config validation, thống nhất index và lifecycle         |

UI, repository nghiệp vụ project/dataset và xóa local phía client không thuộc trách nhiệm Phúc tự làm toàn bộ. Tuy nhiên, chưa có tích hợp thì chưa thể nghiệm thu đầy đủ auth/ownership/logout cho sản phẩm chung.

## 6. Kết quả kiểm chứng và giới hạn bằng chứng

| Kiểm tra                                              | Kết quả trong lượt review                                    | Phạm vi                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `npm run check` khi không đặt MONGODB_TEST_URI        | Đạt                                                          | Typecheck, lint, tests và build                                                          |
| Unit/API                                              | 61 tests đạt, 3 tests MongoDB skip; 6 files đạt, 1 file skip | Auth/ownership chủ yếu dùng repository bộ nhớ có nhãn TEST DOUBLE                        |
| Băm mật khẩu cost mặc định                            | Test hiện có đạt                                             | Không phải benchmark tải đồng thời production                                            |
| Build web/API                                         | Đạt                                                          | Không chứng minh Atlas production hoạt động                                              |
| `npm run test:e2e`                                    | 2/2 đạt trên Chrome                                          | Smoke shell và API liveness; chưa có form auth/browser login đầu cuối                    |
| 12 login sai đồng thời                                | Cả 12 trả 401, request tiếp theo 429                         | Tái hiện PHUC-01 với cost scrypt giảm                                                    |
| Mutation thiếu CSRF sau 23 giờ                        | 403 nhưng idle expiry được gia hạn                           | Tái hiện PHUC-02 bằng đồng hồ test                                                       |
| Đăng ký/login bằng hai chuỗi lone surrogate khác nhau | 201 rồi 200                                                  | Tái hiện PHUC-03, không dùng tài khoản/database thật                                     |
| MONGODB_TEST_URI là chuỗi rỗng                        | Suite lỗi khi collection                                     | Tái hiện PHUC-04; trường hợp không đặt biến đã chạy lại và đạt                           |
| MongoDB local / Atlas integration                     | Không chạy lại trong review                                  | `auth-results.md` của Phúc ghi 3/3 đạt trên MongoDB local và 3/3 trên Atlas ở lượt trước |

Không coi tests bộ nhớ hoặc smoke `/health` là xác minh Atlas. Lượt review không kiểm chứng lại trạng thái index/dữ liệu trên Atlas, production auth với Atlas, quyền truy cập tài nguyên thật của Tuấn hoặc logout/offline/local đầu cuối.

## 7. Đối chiếu báo cáo cá nhân

Báo cáo `docs/teamwork/Phuc.md` phân biệt được tests bộ nhớ với MongoDB thật, ghi rõ chưa chốt contract, wiring database tạm, ownership mới trên route test và phần client chưa tích hợp. Kết quả 61 tests đạt/3 skip và 2 smoke E2E đã được chạy lại với phạm vi tương ứng.

Nhãn “đã hoàn thành phía server” cần bổ sung danh sách lỗi phát hiện qua review trước khi dùng làm căn cứ nghiệm thu. Phần ghi chú Git đang nói 5 commit, commit mới nhất `c40f75e` và báo cáo chưa commit; tại thời điểm review nhánh đã có 6 commit, đầu nhánh là `edae04f` và báo cáo đã được push.

## 8. Thứ tự hoàn thiện đề xuất

1. Sửa PHUC-01, PHUC-02 và PHUC-03; thêm test hồi quy cho concurrent login, activity của request bị từ chối và Unicode lỗi.
2. Sửa PHUC-04 để suite Mongo skip nhất quán khi URI không cấu hình hoặc rỗng.
3. Chốt các điểm mở với Phát/Tuấn/Trâm và cập nhật contracts/tài liệu cùng đợt tích hợp.
4. Phối hợp Trâm hoàn thiện plugin/config database; kiểm tra index và lỗi kết nối trên môi trường được nhóm chỉ định.
5. Phối hợp Tuấn kiểm tra ownership trên route nghiệp vụ thật; Phát nối form và xử lý ma trận lỗi.
6. Kiểm chứng auth production với Atlas và logout gắn local/outbox khi môi trường và luồng tích hợp sẵn sàng; ghi expected/actual và phạm vi dọn dữ liệu test rõ ràng.
7. Cập nhật báo cáo bàn giao theo commit mới và bằng chứng kiểm tra thực tế.

**Trạng thái đánh giá: Phần lớn backend auth độc lập đã triển khai; cần sửa lỗi và hoàn tất chốt/tích hợp trước khi nghiệm thu nhiệm vụ đầy đủ.**
