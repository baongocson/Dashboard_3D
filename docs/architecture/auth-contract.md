# Hợp đồng tài khoản và phiên đăng nhập (bản nháp chờ chốt)

Ngày: 06/11/2026. Người phụ trách: Phúc (`apps/api/src/modules/auth`, `apps/api/src/modules/users`). Cần Phát (UI), Tuấn (ownership/sync) và Trâm (database/config) xác nhận trước khi coi là đã chốt. Mọi điểm còn mở nằm ở mục 7.

Schema dùng chung: `packages/contracts/src/index.ts`, phần _Accounts_. Không tự đổi tên trường; nếu cần đổi, sửa contracts và các bên dùng trong cùng một đợt.

## 1. Quy tắc dữ liệu

| Nội dung           | Quy tắc đang triển khai                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Username           | Sau trim: 3–30 ký tự `A-Z a-z 0-9 _ - .`. Lưu nguyên dạng đã trim để hiển thị                                                       |
| Chuẩn hoá username | `trim().toLowerCase()` → `usernameNormalized`, unique index `users_usernameNormalized_unique`                                       |
| Mật khẩu           | 15–128 **Unicode code point** (😀 tính 1). Cho phép khoảng trắng/Unicode. Không trim, không đổi hoa/thường, không normalize NFC/NFD |
| Băm mật khẩu       | `scrypt` của Node, N=2^17, r=8, p=1, salt 16 byte, key 64 byte (OWASP). Tham số lưu trong chuỗi hash để có thể nâng sau             |
| Tên hiển thị       | Mặc định = username; 1–50 ký tự sau trim; đổi qua `PATCH /users/me`                                                                 |
| Phiên đăng nhập    | Lưu server-side (`auth_sessions`). Cookie chỉ chứa token ngẫu nhiên 32 byte; DB lưu HMAC-SHA256(SESSION_SECRET, token)              |
| Thời hạn           | Idle 24 h, tuyệt đối 7 ngày từ lúc đăng nhập. Luôn dùng đồng hồ server                                                              |
| “Hoạt động hợp lệ” | Mọi request đã xác thực **trừ** request có header `x-session-activity: background`. Ghi gia hạn tối đa 1 lần/60 giây                |
| Cookie             | `dashboard_session`, HttpOnly, SameSite=Lax, Path=/, Secure khi mọi origin cho phép là https. Không dùng token trong localStorage   |

## 2. Endpoint

Mọi request thay đổi dữ liệu (POST/PUT/PATCH/DELETE) trên **toàn API** phải có header `Origin` nằm trong `WEB_ORIGIN`; thiếu hoặc sai → 403 `ORIGIN_REJECTED`. Frontend gọi bằng `fetch(..., { credentials: 'include' })`. Các response của `/auth/*` có `Cache-Control: no-store`.

| Method + path         | Cần đăng nhập  | Cần CSRF | Body                     | Thành công                                 |
| --------------------- | -------------- | -------- | ------------------------ | ------------------------------------------ |
| `POST /auth/register` | Không          | Không    | `{ username, password }` | 201 `{ user }`, **không** set cookie       |
| `POST /auth/login`    | Không          | Không    | `{ username, password }` | 200 `AuthSessionResponse` + set cookie     |
| `GET /auth/session`   | Có (cookie)    | —        | —                        | 200 `AuthSessionResponse`                  |
| `POST /auth/logout`   | Không bắt buộc | Không    | —                        | 204, xoá cookie, thu hồi phiên phía server |
| `GET /users/me`       | Có             | —        | —                        | 200 `{ user }`                             |
| `PATCH /users/me`     | Có             | Có       | `{ displayName }`        | 200 `{ user }`                             |

`user` = `{ id, username, displayName }`; không bao giờ có `passwordHash`. `AuthSessionResponse` = `{ user, csrfToken, idleExpiresAt, absoluteExpiresAt }` (ISO UTC).

- Đăng ký thành công → UI chuyển sang trang đăng nhập; không tự đăng nhập.
- Đăng nhập trên trình duyệt đang có phiên → phiên cũ bị thu hồi.
- `csrfToken` gửi lại trong header `x-csrf-token` cho mọi mutation đã đăng nhập. Lấy lại bằng `GET /auth/session` sau khi tải trang (giữ trong bộ nhớ, không cần localStorage).
- Logout chỉ kiểm tra Origin, không đòi CSRF và luôn trả 204 (kể cả phiên đã hết hạn). Nhờ vậy bản ghi thu hồi phiên tạo lúc offline vẫn gửi lại được khi có mạng.

## 3. Ma trận lỗi

Định dạng chung (`apiErrorResponseSchema`): `{ "error": { "code", "message", "issues"?, "retryAfterSeconds"? } }`. UI quyết định theo `code`, không theo `message`.

| HTTP | `code`                 | Khi nào                                                                   | UI nên làm                                                |
| ---- | ---------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`     | Thiếu/sai định dạng; có `issues[{ path, message }]`. Body lạ/quá lớn      | Hiển thị lỗi theo trường                                  |
| 401  | `INVALID_CREDENTIALS`  | Sai username **hoặc** mật khẩu (cùng một thông điệp, cùng thời gian băm)  | Báo sai thông tin, không nói trường nào sai               |
| 401  | `AUTH_REQUIRED`        | Không có cookie/cookie không hợp lệ                                       | Về trang đăng nhập                                        |
| 401  | `SESSION_EXPIRED`      | Phiên hết idle/tuyệt đối hoặc đã đăng xuất; cookie bị xoá                 | Đăng nhập lại; **giữ** dữ liệu local và outbox            |
| 403  | `ORIGIN_REJECTED`      | Mutation không có Origin hợp lệ                                           | Lỗi cấu hình, không thử lại                               |
| 403  | `CSRF_INVALID`         | Mutation đã đăng nhập thiếu/sai `x-csrf-token`                            | Gọi `GET /auth/session` lấy token mới rồi thử lại một lần |
| 404  | `NOT_FOUND`            | Tài nguyên không tồn tại hoặc không thuộc người dùng (dùng cho ownership) | Báo không tìm thấy                                        |
| 409  | `USERNAME_TAKEN`       | Username đã tồn tại sau chuẩn hoá, kể cả hai request đồng thời            | Báo trùng tên                                             |
| 429  | `TOO_MANY_ATTEMPTS`    | Quá số lần đăng nhập sai; có `retryAfterSeconds` và header `Retry-After`  | Khoá nút, hiển thị thời gian chờ                          |
| 503  | `DATABASE_UNAVAILABLE` | Chưa cấu hình MongoDB hoặc không kết nối được                             | Báo backend/Atlas chưa sẵn sàng; không tạo tài khoản tạm  |
| 500  | `INTERNAL_ERROR`       | Lỗi không lường trước (không lộ chi tiết)                                 | Báo lỗi chung, cho thử lại                                |

Giới hạn đăng nhập sai: 5 lần/15 phút theo (IP + username chuẩn hoá), 50 lần/15 phút theo IP. Đăng nhập đúng xoá bộ đếm theo tài khoản. Không khoá theo username đơn thuần để tránh người khác khoá tài khoản nạn nhân.

## 4. Giao diện cho Tuấn (ownership)

```ts
// Route cần đăng nhập: kiểm tra cookie + CSRF cho mutation, gắn request.auth.
app.get('/projects', { preHandler: app.requireAuth }, async (request) => {
  const ownerId = requireUserId(request); // requireUserId, requireOwned: modules/auth/auth.module.ts
  return projects.listByOwner(ownerId); // luôn lọc theo ownerId trong query
});
```

- `request.auth` = `{ userId, sessionId, user }`. `projectSchema.ownerId` = `user.id`.
- Tài nguyên của người khác trả 404 `NOT_FOUND`, không 403, để không lộ sự tồn tại. Ưu tiên lọc theo owner ngay trong query (`{ _id, ownerId }`). Khi đã đọc theo ID, dùng `requireOwned(request, record)`: record thiếu hoặc của người khác đều thành 404.
- `ownerId` luôn lấy từ `requireUserId(request)`, không bao giờ lấy từ body. Mẫu đầy đủ (list/create/get/patch/delete): `apps/api/src/modules/auth/ownership.test.ts`.
- Lỗi dùng chung nằm ở `apps/api/src/shared/`: `ApiError`, `DatabaseUnavailableError` (`api-error.ts`) và `guardMongo` (`mongo-errors.ts`). Bọc mỗi lệnh driver bằng `guardMongo(() => …, onDuplicateKey?)`: mất kết nối → 503, trùng unique index → lỗi do module tự định nghĩa, lỗi khác → 500 (không che bug thành 503).
- Request sync chạy nền gửi `x-session-activity: background` để không gia hạn phiên.

## 5. Lưu trữ MongoDB (phối hợp Trâm)

| Collection      | Document                                                                                                                    | Index                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `users`         | `_id` (UUID string), `username`, `usernameNormalized`, `displayName`, `passwordHash`, `createdAt`, `updatedAt`              | unique `usernameNormalized`                                         |
| `auth_sessions` | `_id`, `tokenHash`, `userId`, `csrfToken`, `createdAt`, `lastActivityAt`, `idleExpiresAt`, `absoluteExpiresAt`, `revokedAt` | unique `tokenHash`; `userId`; TTL `absoluteExpiresAt` (chỉ dọn dẹp) |

`createMongoAuthStores(db)` trong `modules/auth/stores.ts` tạo adapter và index. `server.ts` hiện nối tạm khi có `MONGODB_URI` + `MONGODB_DB_NAME` + `SESSION_SECRET` (≥ 32 ký tự); khi Trâm có plugin database và kiểm tra env trong `apps/api/src/plugins`, `apps/api/src/config`, thay đoạn nối tạm đó bằng plugin. Không có `MONGODB_URI` → mọi API tài khoản trả 503.

## 6. Đăng xuất và dữ liệu local (phía client — Phát/Trâm/Tuấn)

Server chỉ thu hồi phiên. Chính sách xoá local theo prompt công nghệ §9 do client thực hiện:

- Offline + còn dữ liệu chờ đồng bộ → chặn đăng xuất.
- Offline + không có dữ liệu chờ → xoá local của tài khoản, giữ bản ghi thu hồi tối thiểu rồi gửi `POST /auth/logout` khi có mạng (luôn 204).
- Online → cho đồng bộ trước, hoặc đăng xuất và xoá dữ liệu chưa sync sau xác nhận rõ ràng.
- Sync lỗi không tự xoá local. `SESSION_EXPIRED` không xoá local/outbox. Thoát phiên làm việc không phải đăng xuất.

## 7. Điểm còn mở cần nhóm chốt

1. Đơn vị độ dài mật khẩu: đang dùng code point (đề xuất trong task-01-decisions).
2. Định nghĩa “hoạt động hợp lệ” bằng header `x-session-activity: background` — Tuấn/Phát xác nhận client sync sẽ gửi header này.
3. Rate limit nằm trong bộ nhớ một tiến trình: đúng cho modular monolith localhost, mất khi khởi động lại; triển khai nhiều instance cần store chung.
4. Có cần `GET /auth/session` trả thêm trạng thái gì cho offline workspace (ví dụ `accountId` để tách IndexedDB theo tài khoản) — đề xuất dùng `user.id`.
5. Vị trí cuối cùng của error handler chung và phần nối MongoDB khi Trâm triển khai plugin.
