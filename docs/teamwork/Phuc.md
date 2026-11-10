# Báo cáo tiến độ — Phúc (Backend tài khoản)

**Nhánh làm việc:** `codex/phuc-backend-auth`
**Phạm vi:** `apps/api/src/modules/auth`, `apps/api/src/modules/users`, phần _Accounts_ trong `packages/contracts`.
**Trạng thái:** Đã hoàn thành phía server cho đăng ký, đăng nhập, phiên và bảo vệ API; đã kiểm chứng lưu trữ trên MongoDB Atlas. **Chưa chốt contract với nhóm, chưa có PR, chưa merge vào `main`.**

Chi tiết kỹ thuật: [auth-contract.md](../architecture/auth-contract.md). Kết quả kiểm thử đầy đủ: [auth-results.md](../testing/auth-results.md).

## 1. Đã thực hiện (theo 6 bước trong phân công)

| #   | Nhiệm vụ                                                                 | Trạng thái             | Ghi chú                                                                                                                                |
| --- | ------------------------------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Schema tài khoản, request/response trong contracts                       | Đã soạn, **chưa chốt** | Phần _Accounts_ trong `packages/contracts/src/index.ts`; còn 5 điểm mở (mục 4)                                                         |
| 2   | Unique index username chuẩn hoá, chống đăng ký trùng đồng thời           | Xong                   | `users_usernameNormalized_unique`; 3 đăng ký trùng đồng thời → 1×201 + 2×409                                                           |
| 3   | Băm mật khẩu, không lưu/log mật khẩu thô, không trả hash                 | Xong                   | `scrypt` (N=2^17, r=8, p=1); log không chứa mật khẩu; response không có `passwordHash`                                                 |
| 4   | Đăng ký chỉ username/password, đăng nhập đúng mới tạo phiên              | Xong                   | Register 201 không set cookie → UI chuyển về đăng nhập; login 200 + cookie                                                             |
| 5   | Cookie/session, CSRF/Origin/CORS, giới hạn đăng nhập, giao diện cho Tuấn | Xong                   | Phiên server-side (idle 24 h, tuyệt đối 7 ngày); rate limit 5/15 phút theo IP+username; `requireAuth`, `requireUserId`, `requireOwned` |
| 6   | Kiểm thử sai mật khẩu, chưa đăng nhập, hết phiên, hai tài khoản, logout  | Xong phía server       | Logout gắn với sync/xoá local thuộc phía client, chưa làm                                                                              |

Ngoài ra: lỗi dùng chung `ApiError`, `guardMongo` trong `apps/api/src/shared/` (mất kết nối → 503, lỗi khác → 500 không lộ chi tiết) để Tuấn dùng lại.

## 2. Kết quả kiểm tra

| Hạng mục                                          | Kết quả                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run check` (typecheck, lint, test, build)    | Đạt; 61 test đạt, 3 test MongoDB skip khi không có biến môi trường (chạy lại 08/11) |
| `npm run test:e2e`                                | 2/2 đạt (07/11)                                                                     |
| Test tích hợp MongoDB local (MongoDB 7)           | 3/3 đạt                                                                             |
| Test tích hợp **MongoDB Atlas** (`dashboard_dev`) | 3/3 đạt (07/11), dọn sạch bản ghi sau test                                          |
| Production `server.js` + curl                     | Đạt với MongoDB local (06/11); không có MongoDB → 503 `DATABASE_UNAVAILABLE`        |
| Mutation test tắt kiểm tra CSRF                   | Test fail đúng như mong đợi, đã khôi phục mã                                        |

**Phạm vi xác nhận:** Các ca auth/ownership trong unit test dùng repository bộ nhớ có nhãn TEST DOUBLE; lưu trữ thật được xác nhận riêng bằng test tích hợp trên MongoDB local và Atlas.

## 3. Chưa hoàn thành / chưa kiểm chứng

- **Contract chưa chốt:** cần Phát, Tuấn, Trâm xác nhận [auth-contract.md](../architecture/auth-contract.md).
- **Production với Atlas:** luồng `server.js` + curl mới chạy với MongoDB local, chưa chạy với Atlas.
- **Ownership trên route thật:** mới kiểm thử bằng route mẫu `/test-notes` trong test; cần route project/dataset của Tuấn.
- **Kết nối MongoDB tạm:** `apps/api/src/server.ts` đang nối trực tiếp; cần thay bằng plugin database của Trâm.
- **UI đăng ký/đăng nhập:** chưa có (phần của Phát).
- **Đăng xuất phía client:** chính sách xoá local/outbox khi đăng xuất chưa triển khai (Phát/Trâm/Tuấn).
- **Rate limit:** lưu trong bộ nhớ một tiến trình, mất khi khởi động lại; chưa hỗ trợ nhiều instance (chưa cần cho localhost).

## 4. Điểm cần nhóm chốt

1. Độ dài mật khẩu tính theo Unicode code point (15–128).
2. Request sync chạy nền gửi `x-session-activity: background` để không gia hạn phiên — Tuấn/Phát xác nhận.
3. Rate limit trong bộ nhớ một tiến trình là đủ cho bản đầu.
4. Dùng `user.id` từ `GET /auth/session` để tách dữ liệu IndexedDB theo tài khoản.
5. Vị trí cuối cùng của error handler chung và phần nối MongoDB khi Trâm có plugin.

## 5. Phụ thuộc cần phối hợp

- **Phát (UI):** nối form đăng ký/đăng nhập theo bảng endpoint và ma trận lỗi; gọi `fetch(..., { credentials: 'include' })`, gửi `x-csrf-token` cho mutation.
- **Tuấn (project/sync):** dùng `requireAuth`, `requireUserId`, `requireOwned`; tài nguyên của người khác trả 404; mẫu đầy đủ tại `apps/api/src/modules/auth/ownership.test.ts`.
- **Trâm (database/config):** thay đoạn nối MongoDB tạm trong `server.ts` bằng plugin và kiểm tra env; xác nhận schema `users`, `auth_sessions` và index.

## 6. Kế hoạch tiếp theo

1. Mở PR vào `main` để Tuấn review.
2. Chốt 5 điểm mở ở mục 4 với Phát, Tuấn, Trâm; cập nhật contract nếu có thay đổi.
3. Chạy luồng production với Atlas (username có hậu tố riêng, dọn bản ghi sau khi chạy) và cập nhật [auth-results.md](../testing/auth-results.md).
4. Hỗ trợ Phát nối UI đăng nhập; kiểm thử đầu cuối khi UI sẵn sàng.
5. Kiểm tra ownership trên route project thật khi Tuấn push; chuyển sang plugin database khi Trâm push.

**Ghi chú Git:** Nhánh `codex/phuc-backend-auth` đã push lên `origin` (5 commit, commit mới nhất `c40f75e`). Chưa tạo Pull Request, chưa merge vào `main`. File báo cáo này chưa được commit.
