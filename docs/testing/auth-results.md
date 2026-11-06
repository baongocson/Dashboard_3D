# Kiểm chứng tài khoản — nhánh `codex/phuc-backend-auth`

Ngày kiểm tra: 06/11/2026, Asia/Saigon. Chỉ áp dụng cho `modules/auth`, `modules/users` và phần auth trong contracts.

## Môi trường

- Windows 11 Pro, Node.js 24.22.2 (bản portable; Node cài sẵn trên máy là 20.12, không chạy được Vitest/rolldown), npm 11.19.1.
- MongoDB 7.0.45 local trong container Docker dùng một lần (`mongo:7`). Docker chỉ dùng để kiểm chứng, không phải dependency của dự án.
- Dependency mới của API (ghim chính xác): `@fastify/cookie` 11.1.5 (MIT), `@fastify/cors` 11.4.1 (MIT), `mongodb` 7.8.0 (Apache-2.0).

## Expected / actual

| Kiểm tra                                                    | Expected                                                                      | Actual                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------- |
| `npm run check`                                             | typecheck, lint, tests, build đạt                                             | Đạt; 47 tests đạt, 3 tests Mongo skip |
| `npm run test:e2e`                                          | Smoke nền tảng không bị ảnh hưởng                                             | 2/2 đạt, Chrome                       |
| `MONGODB_TEST_URI=… vitest run …/mongo.integration.test.ts` | Unique index, 3 đăng ký trùng đồng thời → 1×201 + 2×409, chỉ lưu hash/HMAC    | 3/3 đạt trên MongoDB 7 local          |
| Production `node apps/api/dist/server.js` không có MongoDB  | register/login 503 `DATABASE_UNAVAILABLE`, không cookie                       | Đạt                                   |
| Production với `MONGODB_URI` (curl)                         | 201 → 409 trùng → login 200 → thiếu CSRF 403 → có CSRF 200 → logout 204 → 401 | Đạt; DB chỉ có `scrypt$v1$…`          |
| Log server có chứa mật khẩu                                 | Không                                                                         | Không tìm thấy                        |
| Mutation test: tắt kiểm tra CSRF                            | Test phải fail                                                                | Fail đúng 1 test, đã khôi phục mã     |

Các ca trong `apps/api/src/modules/auth/auth.test.ts` (dùng repository bộ nhớ có nhãn TEST DOUBLE): đầu vào thiếu/sai, biên độ dài, mật khẩu Unicode/khoảng trắng giữ nguyên, trùng sau chuẩn hoá, hai đăng ký đồng thời, sai mật khẩu và sai username trả cùng lỗi, thuộc tính cookie, chưa đăng nhập, cookie giả, hết idle 24 h, request nền không gia hạn, hết hạn tuyệt đối 7 ngày, logout thu hồi phía server và idempotent, đăng nhập mới thu hồi phiên cũ, Origin/CORS, CSRF (thiếu, sai, token của tài khoản khác), tách dữ liệu hai tài khoản, rate limit và mở lại sau cửa sổ.

## Chưa kiểm chứng

- **MongoDB Atlas: not verified.** Chỉ kiểm chứng MongoDB 7 local; chưa có credential Atlas, chưa đo độ trễ/TLS/quyền user Atlas.
- Chưa có UI đăng ký/đăng nhập (Phát) và chưa có route nghiệp vụ dùng `requireAuth` (Tuấn), nên ownership của project/dataset chưa kiểm thử đầu cuối.
- Chính sách xoá local khi đăng xuất là phía client, chưa triển khai.
- Rate limit trong bộ nhớ một tiến trình; chưa kiểm thử nhiều instance.
- `npm run format:check` trên Windows với `core.autocrlf=true` báo mọi file vì CRLF, không riêng file auth. Các file mới đã chạy Prettier.
