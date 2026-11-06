# Dashboard 3D

Dashboard web phục vụ quan sát chất lượng và tiền xử lý dữ liệu bằng biểu đồ 3D. Luồng ưu tiên:

**Nhập CSV → Collection → Next → Missing 3D → chọn điểm/ô → xem trước điền giá trị → Áp dụng → tự lưu → Thoát/Mở lại phiên.**

Hiện tại dự án đã có hợp đồng dữ liệu và nền tảng chạy local của nhiệm vụ 01–02. Luồng trên là mục tiêu triển khai tiếp theo, chưa phải chức năng đã hoàn thành.

## Trạng thái hiện tại

| Đã có                                                         | Chưa triển khai                           |
| ------------------------------------------------------------- | ----------------------------------------- |
| npm workspaces, React/Vite và Fastify                         | Nhập CSV, thống kê Collection và Next     |
| Schema runtime và kiểu dữ liệu dùng chung                     | Biểu đồ dữ liệu 3D và chọn điểm/ô         |
| Worker kiểm tra thông điệp ping/ready/error                   | Xử lý dữ liệu, preview, Apply và hoàn tác |
| TypeScript strict, lint, unit tests và production smoke tests | IndexedDB, tự lưu và khôi phục phiên      |
| Giao diện Collection ở trạng thái chưa có dữ liệu             | Tài khoản, Atlas, offline/PWA và đồng bộ  |

Three.js và React Three Fiber đã được cài; cảnh biểu đồ thực tế thuộc nhiệm vụ 06. API hiện không kết nối MongoDB Atlas.

## Yêu cầu môi trường

- Node.js **24.x**, npm **11.x**, theo `engines` trong `package.json`.
- Google Chrome có sẵn nếu chạy Playwright: cấu hình hiện dùng `channel: 'chrome'`.
- Chạy các lệnh dưới đây tại thư mục gốc chứa `package.json`. Không cần dùng cùng đường dẫn tuyệt đối giữa các máy.

## Cài đặt và chạy local

```powershell
npm ci
npm run dev
```

- Web: [http://localhost:4173](http://localhost:4173).
- API liveness: [http://localhost:3001/health](http://localhost:3001/health).

Endpoint `/health` trả:

```json
{ "status": "ok", "database": "not-configured", "syncReady": false }
```

Kết quả này chỉ xác nhận API đang chạy, không xác nhận Atlas hoặc đồng bộ sẵn sàng. Dùng `Ctrl+C` để dừng web và API.

Để chạy bản build production:

```powershell
npm run build
npm start
```

Dev và production đều dùng web origin `http://localhost:4173`; dừng dev trước khi chạy production để tránh trùng cổng. Bản hiện tại chưa có cache offline.

## Lệnh kiểm tra

| Lệnh                   | Chức năng                                                       |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Chạy Vite và API ở chế độ theo dõi thay đổi                     |
| `npm run build`        | Build web production và biên dịch API ra JavaScript             |
| `npm start`            | Chạy hai bản build đã có; không tự build                        |
| `npm run typecheck`    | Kiểm tra kiểu riêng cho contracts, engine, web, API và tooling  |
| `npm run lint`         | ESLint type-aware, kiểm tra quy tắc kiểu và ranh giới mã        |
| `npm test`             | Chạy Vitest cho hợp đồng dữ liệu và API nền tảng                |
| `npm run check`        | Chạy typecheck, lint, tests và build                            |
| `npm run test:e2e`     | Tự build, mở production servers và chạy smoke tests bằng Chrome |
| `npm run format:check` | Kiểm tra định dạng bằng Prettier                                |
| `npm run format`       | Định dạng mã và tài liệu thuộc phạm vi cấu hình                 |

Dừng các server đang dùng cổng 4173/3001 trước khi chạy E2E. Smoke tests hiện kiểm tra nền tảng, không chứng minh luồng CSV, offline hay lưu Atlas đã hoạt động.

Kết quả được ghi nhận ngày **05/11/2026**: 16 unit/API tests và 2 E2E tests đạt; xem [báo cáo kiểm chứng](docs/testing/task-01-02-results.md) để biết môi trường và giới hạn. Đây là kết quả đã ghi trong tài liệu, không phải một lần chạy kiểm thử mới khi cập nhật README.

## Công nghệ và tổ chức mã

- Frontend: React, Vite, TypeScript; Three.js và React Three Fiber cho phần 3D.
- Xử lý phía trình duyệt: Web Worker và package engine TypeScript thuần.
- Backend: Node.js, Fastify, kiến trúc Modular Monolith.
- Lưu trữ dự kiến theo đặc tả: IndexedDB phía local, MongoDB Atlas qua backend. Hai phần này chưa được tích hợp.
- Kiểm tra: Zod, ESLint/typescript-eslint, Vitest và Playwright.

```text
apps/
  web/src/
    app/                 # Giao diện và khởi tạo ứng dụng
    workers/             # Worker nền tảng
  api/src/               # Fastify, server và API liveness
packages/
  contracts/src/         # Schema runtime và kiểu dùng chung
  data-engine/src/       # Cửa vào engine thuần; chưa có pipeline xử lý
tests/
  fixtures/              # Input/expected cho các bước triển khai sau
  e2e/                   # Smoke tests production
docs/
  prompt/                # Hai yêu cầu chính thức
  architecture/          # Quyết định hợp đồng và nền tảng
  requirements/          # Bản đề xuất nguồn
  testing/               # Kết quả kiểm chứng
  teamwork/              # Phân công thành viên
```

Engine không phụ thuộc React, DOM hoặc MongoDB. Chỉ tạo module/thư mục chức năng khi có mã thực tế, không sinh các lớp rỗng. Phiên bản dependency cụ thể nằm trong `package.json` và `package-lock.json`.

## Cấu hình và dữ liệu nhạy cảm

[`.env.example`](.env.example) chỉ chứa cấu hình mẫu và placeholder. Nền tảng hiện không tự nạp tệp `.env`; API đọc `PORT` từ process environment, mặc định 3001. Thay cổng khi cần cũng phải đối chiếu cấu hình E2E.

Không commit tệp credential hoặc env thật, không đưa `MONGODB_URI`, mật khẩu hoặc session secret vào frontend hay biến `VITE_*`. Các biến Atlas/session trong mẫu dành cho giai đoạn tích hợp sau; chưa cần cấu hình Atlas để chạy nền tảng hiện tại.

## Tài liệu và bước tiếp theo

- [Yêu cầu chức năng và tương tác 3D](docs/prompt/prompt_tong_quan_chuc_nang_va_tuong_tac_3d.md).
- [Yêu cầu công nghệ và tổ chức triển khai](docs/prompt/prompt_cong_nghe_dashboard_3d.md).
- [Quy tắc và hợp đồng — nhiệm vụ 01](docs/architecture/task-01-decisions.md).
- [Kiến trúc và cách chạy — nhiệm vụ 02](docs/architecture/foundation.md).
- [Bản đề xuất nguồn](docs/requirements/proposed-rules-source.md).
- [Kết quả kiểm chứng 01–02](docs/testing/task-01-02-results.md).

Bước tiếp theo: **03 — lưu local nhất quán và khôi phục sau lỗi**, rồi 04 CSV Worker → 05 Collection/Next → 06 Missing 3D → 07 preview → 08 Apply/tự lưu → 09 lưu/thoát/mở phiên → 10 hoàn tác và E2E. Sau đó mở rộng phương pháp 11–15, tài khoản 16, Atlas 17, đồng bộ 18, offline/đăng xuất 19 và nghiệm thu 20.

Bản đầu không có nhập Excel/JSON, xuất tệp, AI, SMTP/email/OTP, huấn luyện mô hình hoặc giao diện chỉnh sửa nhánh. CSV tối đa **20.000.000 byte (20 MB thập phân)** theo hai tài liệu chính thức.
