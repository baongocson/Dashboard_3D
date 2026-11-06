# Kiểm chứng nhiệm vụ 01–02

Ngày kiểm tra: 2026-11-05, Asia/Saigon. Chỉ áp dụng cho hợp đồng và nền tảng hiện tại.

## Môi trường thực tế

- Windows NT 10.0.26200.0, x64.
- Node.js 24.15.0; npm 11.12.1; TypeScript 5.9.3.
- Google Chrome 156.0.8078.80 (channel chrome có sẵn). Không tải thêm Chromium.
- Máy MSI Thin 15 RAM 16 GB là môi trường hiệu năng người dùng đề xuất; chưa xác minh phần cứng hoặc đo ngân sách hiệu năng trên máy đó. Chưa chạy đối chiếu Edge.

## Expected / actual

| Lệnh / kiểm tra                         | Expected                                                                                                    | Actual                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm install`                           | Resolve peer dependencies, có lockfile                                                                      | Đạt; registry cần quyền mạng ngoài sandbox                                                |
| `npm ls --depth=0`                      | Không invalid/missing peer bắt buộc                                                                         | Đạt; React 19.3.1, R3F 9.8.2, Three 0.187.0                                               |
| `npm run typecheck`                     | Kiểm tra riêng contracts/engine/web/api/tools với strict flags                                              | Đạt                                                                                       |
| `npm run lint`                          | Không explicit/unsafe any, không lách kiểu, không API deprecated                                            | Đạt sau bỏ `.finite()` thừa của Zod 4; không tắt rule                                     |
| `npm test`                              | Reject giá trị không hợp lệ, bảo toàn ID/type, publication references, stale chart; API liveness trung thực | 16 tests đạt, 2 files; lượt cuối khoảng 828 ms theo Vitest, không phải benchmark sản phẩm |
| `npm run build`                         | Web production và Node API emit thành công                                                                  | Đạt; web khoảng 221 kB JS trước gzip ở mốc này; chưa bundle cảnh 3D                       |
| `npm run test:e2e`                      | Production shell, mobile width, reload, không pageerror; health không nhận Atlas ready                      | 2 tests đạt trong 8,7 s, Chrome; cần quyền localhost/browser ngoài sandbox                |
| `npm run dev`                           | Web và API khởi động cùng lúc                                                                               | Đạt; cả http://localhost:4173 và http://localhost:3001/health trả HTTP 200                |
| License metadata dependencies trực tiếp | Có license metadata                                                                                         | Đạt; MIT hoặc Apache-2.0; chưa kiểm toán toàn bộ dependency tree                          |
| `git diff --name-only -- docs/prompt`   | Không sửa hai prompt                                                                                        | Không có diff                                                                             |
| `git check-ignore`                      | Credential, node_modules và dist bị ignore                                                                  | Đạt; không đọc hoặc in nội dung credential                                                |
| Hash bản đề xuất lưu lại                | Khớp file người dùng gửi                                                                                    | SHA-256 `04E84326FED54ED2564129A6C9F17A5E6DD22F9637E77E1F695F97A345181736`                |

## Vấn đề môi trường đã xử lý

- Shim `.cmd` của CLI lỗi với đường dẫn chứa `&`; scripts hiện gọi entrypoint Node tương đối. Entry point concurrently v10 là `dist/bin/index.js`.
- TypeScript registry latest 7 không thuộc peer range typescript-eslint hiện tại; dùng 5.9.3. ESLint 9 bị registry báo hết hỗ trợ nên đổi sang ESLint 10 tương thích.
- Sandbox không resolve npm hoặc truy cập loopback cho Playwright; thử trong sandbox không được tính là đạt. Lượt kiểm chứng có quyền mạng/localhost mở rộng đã chạy thành công, không bỏ test và không dùng test double cho browser.
- `README.md` bị xóa sẵn trước lượt làm việc được giữ nguyên. Tài liệu mới đặt trong docs, không khôi phục file của người dùng.

## Chưa kiểm chứng / chưa triển khai

- Catalog fixture trong tests/fixtures/rules.ts chỉ là expected examples cho các nhiệm vụ kế tiếp. Tests schema kiểm tra khả năng biểu diễn một số output CSV kỳ vọng; chưa chạy parser CSV hoặc thuật toán thống kê/Missing/Transformation/Encoding.
- Chưa có IndexedDB commit/recovery, preview engine, undo, chart 3D tương tác, autosave, mở lại dữ liệu, account hoặc sync.
- Atlas: **not configured / not verified**, chưa kết nối, tạo collection/index hoặc thay đổi dữ liệu.
- Offline/PWA, Chrome/Edge performance matrix, quota injection, CSV gần 20 MB, đo RAM, mục tiêu 0,5 s/1 s: **chưa kiểm chứng**.
- Không coi production smoke đạt là nghiệm thu sản phẩm đầy đủ. Bước tiếp theo là nhiệm vụ 03: local storage publication/recovery.
