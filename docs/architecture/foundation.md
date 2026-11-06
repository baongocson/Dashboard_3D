# Nhiệm vụ 02 — Nền tảng local

## Hiện trạng và phạm vi

Repository đã có Git khi bắt đầu lượt triển khai này; `README.md` đang bị xóa sẵn, không khôi phục hoặc ghi đè thay đổi đó. Hai prompt được giữ nguyên. Không đọc tệp credential, không kết nối Atlas. Bản đề xuất người dùng được lưu nguyên văn trong docs/requirements.

Nền tảng gồm npm workspaces, React/Vite, Fastify liveness API, schema contracts, cửa vào engine thuần, strict TS/lint, Vitest và Playwright smoke tests. UI chỉ hiển thị trạng thái chưa có dữ liệu và phạm vi chưa hỗ trợ; không có guest/fake auth, nhập tệp giả, biểu đồ dữ liệu giả, hoặc thông báo đã lưu giả. R3F/Three được cài để chốt peer dependencies; scene thực tế thuộc nhiệm vụ 06.

## Phiên bản và quyết định thư viện

Node hiện tại 24.15.0, npm 11.12.1. Chọn major Node 24 LTS cho dự án; package.json engines và lockfile ràng buộc môi trường.

| Công cụ                    | Phiên bản chọn   | Cơ sở                                                                                            |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| React / react-dom          | 19.3.1           | Stack bắt buộc; khớp R3F 9                                                                       |
| Three / R3F                | 0.187.0 / 9.8.2  | Peer registry: React >=19 <19.4, Three >=0.156                                                   |
| Vite / plugin-react        | 8.3.6 / 5.2.0    | Plugin 5.2 hỗ trợ Vite 8; tránh đổi sang plugin 6 kèm các peer mới không cần thiết               |
| Fastify                    | 5.12.8           | Stack bắt buộc; Node hiện tại đáp ứng                                                            |
| TypeScript                 | 5.9.3            | Registry latest 7.0.2 nằm ngoài peer typescript-eslint >=4.8.4 <6.1; chọn bản stable tương thích |
| ESLint / typescript-eslint | 10.14.0 / 8.72.1 | Type-aware, strict, cấm explicit/unsafe any; bỏ ESLint 9 do registry báo hết hỗ trợ              |
| Zod                        | 4.6.7            | Được chọn từ đề xuất để validate các biên runtime                                                |
| Vitest / Playwright        | 5.1.0 / 1.64.1   | Schema/API tests và smoke production                                                             |
| tsx / concurrently         | 4.23.15 / 10.0.6 | Chạy local TS và hai ứng dụng; không thêm dịch vụ                                                |

Registry kiểm tra ngày 2026-11-05. Chi tiết resolved/transitive version và integrity nằm trong package-lock.json. Giấy phép dependencies trực tiếp kiểm tra qua metadata registry/lockfile; không coi đó là kiểm toán toàn bộ dependency tree.

Tài liệu đối chiếu: [Vite prerequisites](https://vite.dev/guide/), [R3F React pairing](https://r3f.docs.pmnd.rs/getting-started/introduction), [Fastify v5](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/).

Chưa cài Dexie, Papa Parse, router, TanStack Virtual, PWA/Workbox, MongoDB driver hoặc thư viện thuật toán trước nhiệm vụ cần dùng. Không cài Plotly, Python, AI/SMTP, Redis hoặc Docker.

## Ranh giới

- Browser → contracts; Worker → contracts + data-engine. Engine không React/DOM/MongoDB/Node. Có lib ES2023 không DOM trong engine/contracts để typecheck hỗ trợ ranh giới.
- Không có backend source hoặc secret trong package dùng chung/frontend. ESLint chặn import backend/MongoDB phía browser; kiểm tra boundary chi tiết hơn theo module khi các module có triển khai thực.
- Backend là một Fastify app. Modules auth/users/projects/datasets/versions/sessions/charts/sync sẽ được tạo khi có trách nhiệm thực; không sinh hàng loạt routes/services/repositories rỗng.
- Strict, noImplicitAny, noUncheckedIndexedAccess, exactOptionalPropertyTypes; không ts-ignore/ts-nocheck/ts-expect-error, không double assertion để lách validation. skipLibCheck chỉ bỏ kiểm tra nội bộ declaration của thư viện, không tắt kiểm tra mã nhóm.
- `foundation.worker.ts` chỉ ping/ready/error với input unknown được parse; chưa có pipeline dataset, progress, cancel, storage hoặc sync.
- `/health` chỉ liveness, trả database=not-configured và syncReady=false. Không kết luận Atlas sẵn sàng từ endpoint này.

## Local commands

```text
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm start
npm run test:e2e
```

`dev`: Vite + tsx watch. Web origin cố định http://localhost:4173, API http://localhost:3001. Strict port tránh âm thầm đổi origin làm mất khả năng mở IndexedDB cũ.

Scripts gọi CLI qua Node với đường dẫn tương đối thay vì shim node_modules/.bin/*.cmd, vì shim gặp lỗi trên Windows khi workspace có ký tự `&` như `D:\JS & TS\dashboard_3d`. Cách này vẫn chạy qua npm scripts trên các hệ điều hành.

`build`: production web + emitted Node API. `start`: phục vụ hai bản build trên localhost; không có build ngầm. Playwright tự build và khởi động production servers riêng cho smoke, không tái sử dụng một dev server không rõ nguồn.

Chrome channel dùng browser đã có; không tự tải Chromium. Nếu chưa có Chrome, báo chưa kiểm thử browser. Các smoke này không chứng minh offline; PWA/cache và offline E2E chỉ triển khai ở nhiệm vụ 19. `test:integration` chưa tạo script rỗng: thêm khi có storage/API nghiệp vụ cần kiểm tra tích hợp.

`format:check`/`format` dùng Prettier; bỏ qua hai prompt và bản nguồn người dùng để giữ nguyên văn. `.gitignore` loại credential/env/log/build; `.env.example` chỉ placeholder và cấu hình public. Không nạp `.env` thật trong nền tảng, không ghi secret vào VITE_*.

## Giới hạn bàn giao

Chỉ nhận nền tảng chạy được sau typecheck/lint/tests/build và smoke thực tế. Báo số lượng tests, lệnh, môi trường và phần không xác minh trong docs/testing/task-01-02-results.md. Chưa có CSV/Collection thống kê/Missing/preview/commit/khôi phục/tài khoản/Atlas/offline hoàn chỉnh ở mốc này.
