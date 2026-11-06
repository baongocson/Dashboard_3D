# Kiểm chứng tài khoản — nhánh `codex/phuc-backend-auth`

Ngày kiểm tra: 06/11/2026, Asia/Saigon. Chỉ áp dụng cho `modules/auth`, `modules/users` và phần auth trong contracts.

## Môi trường

- Windows 11 Pro, Node.js 24.22.2 (bản portable; Node cài sẵn trên máy là 20.12, không chạy được Vitest/rolldown), npm 11.19.1.
- MongoDB 7.0.45 local trong container Docker dùng một lần (`mongo:7`). Docker chỉ dùng để kiểm chứng, không phải dependency của dự án.
- Dependency mới của API (ghim chính xác): `@fastify/cookie` 11.1.5 (MIT), `@fastify/cors` 11.4.1 (MIT), `mongodb` 7.8.0 (Apache-2.0).

## Expected / actual

| Kiểm tra                                                    | Expected                                                                      | Actual                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `npm run check`                                             | typecheck, lint, tests, build đạt                                             | Đạt; 61 tests đạt, 3 tests Mongo skip (07/11)                |
| `npm run test:e2e`                                          | Smoke nền tảng không bị ảnh hưởng                                             | 2/2 đạt, Chrome                                              |
| `MONGODB_TEST_URI=… vitest run …/mongo.integration.test.ts` | Unique index, 3 đăng ký trùng đồng thời → 1×201 + 2×409, chỉ lưu hash/HMAC    | 3/3 đạt trên MongoDB 7 local; 3/3 đạt trên **Atlas** (07/11) |
| Production `node apps/api/dist/server.js` không có MongoDB  | register/login 503 `DATABASE_UNAVAILABLE`, không cookie                       | Đạt                                                          |
| Production với `MONGODB_URI` (curl)                         | 201 → 409 trùng → login 200 → thiếu CSRF 403 → có CSRF 200 → logout 204 → 401 | Đạt; DB chỉ có `scrypt$v1$…`                                 |
| Log server có chứa mật khẩu                                 | Không                                                                         | Không tìm thấy                                               |
| Mutation test: tắt kiểm tra CSRF                            | Test phải fail                                                                | Fail đúng 1 test, đã khôi phục mã                            |

Các ca trong `apps/api/src/modules/auth/auth.test.ts` (dùng repository bộ nhớ có nhãn TEST DOUBLE): đầu vào thiếu/sai, biên độ dài, mật khẩu Unicode/khoảng trắng giữ nguyên, trùng sau chuẩn hoá, hai đăng ký đồng thời, sai mật khẩu và sai username trả cùng lỗi, thuộc tính cookie, chưa đăng nhập, cookie giả, hết idle 24 h, request nền không gia hạn, hết hạn tuyệt đối 7 ngày, logout thu hồi phía server và idempotent, đăng nhập mới thu hồi phiên cũ, Origin/CORS, CSRF (thiếu, sai, token của tài khoản khác), tách dữ liệu hai tài khoản, rate limit và mở lại sau cửa sổ.

`apps/api/src/modules/auth/ownership.test.ts`: mẫu ownership trên route chỉ có trong test (`/test-notes`). Tài khoản B đọc/sửa/xoá tài nguyên của A đều nhận 404 giống hệt ID không tồn tại; `ownerId` do client gửi bị bỏ qua; chưa đăng nhập 401; cookie thật nhưng thiếu CSRF 403.

`apps/api/src/shared/mongo-errors.test.ts`: lỗi mạng/chọn server/client đóng/lỗi có nhãn retryable → 503 `DATABASE_UNAVAILABLE`. Thiếu quyền, validation, lỗi lập trình → 500 `INTERNAL_ERROR` và không lộ chi tiết. Ca 503 dùng driver thật trỏ tới cổng không có MongoDB.

## Atlas — lần thử 06/11/2026

| Bước                                     | Kết quả                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| DNS SRV của cluster dev                  | Đạt, 3 node shard-00-00/01/02                                                                       |
| TCP 27017 tới 3 node                     | Đạt                                                                                                 |
| TLS / chọn server (timeout 20 s)         | **Thất bại**: `MongoServerSelectionError`, `tlsv1 alert internal error` (SSL alert 80) từ cả 3 node |
| Đăng nhập user, tạo index, test tích hợp | Chưa tới bước này                                                                                   |

SSL alert 80 ngay sau TCP là dấu hiệu Atlas từ chối IP nguồn: IP công khai của máy kiểm tra chưa có trong **Network Access**. Lỗi xảy ra trước bước xác thực nên chưa đánh giá được username/password hay quyền của user.

## Atlas — kiểm chứng 07/11/2026: **đạt**

Leader thêm IP máy kiểm tra vào Network Access của project chứa cluster dev.

| Bước                                                | Kết quả                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| TLS + đăng nhập user dev                            | Đạt                                                                                                                       |
| Quyền của user                                      | Chỉ `readWrite` trên `dashboard_dev` (tối thiểu, đúng). Không tạo/xoá được database khác                                  |
| Test tích hợp với database tạm (cách cũ)            | Bị từ chối `createIndex`/`dropDatabase` trên database ngẫu nhiên, đúng theo quyền                                         |
| `MONGODB_TEST_DB_NAME=dashboard_dev`, 3 test        | **3/3 đạt**: unique index, 3 đăng ký trùng đồng thời → 1×201 + 2×409, chỉ lưu hash/HMAC, logout thu hồi phiên             |
| Dọn dẹp sau test                                    | `users` 0, `auth_sessions` 0 bản ghi; không xoá database                                                                  |
| Index còn lại trên Atlas (do API tạo khi khởi động) | `users_usernameNormalized_unique` (unique); `auth_sessions_tokenHash_unique`, `auth_sessions_userId`, `auth_sessions_ttl` |

Test tích hợp giờ có hai chế độ: không có `MONGODB_TEST_DB_NAME` thì tạo database tạm rồi xoá (MongoDB local); có biến này thì chạy trong database được cấp, chỉ tạo username có hậu tố riêng của lần chạy và chỉ xoá đúng các bản ghi đó.

## Chưa kiểm chứng

- Luồng production `server.js` + curl mới chạy với MongoDB local, chưa chạy với Atlas (để không tạo tài khoản thật trong `dashboard_dev`). Logic lưu trữ trên Atlas đã được test tích hợp bao phủ.
- Chưa có UI đăng ký/đăng nhập (Phát). Ownership mới kiểm thử bằng route mẫu trong test; project/dataset thật cần route của Tuấn.
- Chính sách xoá local khi đăng xuất là phía client, chưa triển khai.
- Rate limit trong bộ nhớ một tiến trình; chưa kiểm thử nhiều instance.
- `npm run format:check` trên Windows với `core.autocrlf=true` báo mọi file vì CRLF, không riêng file auth. Các file mới đã chạy Prettier.
