# Báo cáo tiến độ — Phát (Frontend UI)

**Nhánh làm việc:** `codex/phat-frontend-ui`
**Phạm vi:** Frontend UI — Collection, Pre-processing, điều hướng, bảng dữ liệu, các trạng thái tương tác và tích hợp giao diện với module khác.
**Trạng thái:** Đã hoàn thành bộ khung UI ban đầu và các bài kiểm thử đã viết; **chưa hoàn thành tích hợp chức năng thực tế**.

## 1. Đã thực hiện

- Xây dựng giao diện **Collection**: khu vực chọn CSV, cấu hình nhập (dấu phân cách, tiêu đề, giá trị thiếu), kiểm tra đầu vào, khu vực tổng quan và bảng dữ liệu.
- Xây dựng `DatasetTable`: hiển thị dữ liệu, đánh dấu ô thiếu, chọn ô theo ID và phân trang cơ bản.
- Xây dựng giao diện **Pre-processing**: bố cục công cụ, vùng chờ 3D, form xử lý Missing, chọn ô và hiển thị Preview.
- Hoàn thiện hành vi giao diện đã kiểm tra: chuyển Collection → Pre-processing bằng dữ liệu mẫu; chọn ô thiếu; nhập giá trị; xem trước mà không sửa dữ liệu gốc; hủy Preview; vô hiệu hóa Preview khi dữ liệu nhập không hợp lệ hoặc thay đổi.
- Tạo chế độ **demo chỉ phục vụ phát triển**; ghi chú rõ phần chưa kết nối để tránh hiển thị thành công giả.
- Tạo component điều khiển phiên làm việc (UI) và các file README/AI Prompting Log bản đầu cho những module giao diện.
- Push bộ khung lên GitHub tại nhánh `codex/phat-frontend-ui`, commit `dd6bd13`. Chưa tạo Pull Request, chưa Merge vào `main`.
- Bổ sung bài kiểm thử E2E cho Collection và Pre-processing; tách cấu hình chạy production và development để dữ liệu demo không xuất hiện trong production.

## 2. Kết quả kiểm tra

| Hạng mục                                                                                      | Kết quả                                                                        |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ESLint (`npm run lint`)                                                                       | Đạt ở lần chạy gần nhất                                                        |
| TypeScript (`npm run typecheck`)                                                              | Đạt ở lần chạy gần nhất                                                        |
| Unit/API (`npm test`)                                                                         | 24/24 đạt                                                                      |
| Build (`npm run build`)                                                                       | Đạt                                                                            |
| E2E production (`npm run test:e2e`)                                                           | 8/8 đạt                                                                        |
| E2E development (`npx playwright test --config=tests/dev-e2e/playwright.phat-dev.config.mjs`) | 6/6 đạt                                                                        |
| Responsive                                                                                    | Đã kiểm tra thủ công trên màn hình nhỏ; chưa có bộ kiểm thử responsive tự động |

**Phạm vi xác nhận:** Các kết quả trên áp dụng cho bộ khung, dữ liệu mẫu và các trường hợp đã viết test; không chứng minh chức năng nhập CSV, xử lý 3D hay lưu/đồng bộ thực tế đã hoàn tất.

## 3. Chưa hoàn thành / đang chờ tích hợp

- **CSV Worker thực tế:** Chưa kết nối đọc CSV, phân tích và trả Dataset thật; chưa kiểm tra tiến độ/hủy import end-to-end với Worker thật.
- **3D:** Mới có vùng giao diện chờ scene; chưa kết nối component Three.js và đồng bộ lựa chọn điểm 3D với bảng.
- **Xử lý dữ liệu:** Preview hiện mới có bản demo; chưa kết nối Worker/data-engine thực tế; các module Cleaning, Outliers, Scaling, Transformation, Encoding chưa tích hợp.
- **Apply và lưu cục bộ:** Chưa nối IndexedDB/storage commit, lịch sử, Undo/Redo; giao diện chưa được phép xác nhận Apply/Save thành công.
- **Quản lý phiên:** Chưa có luồng Save/Exit/Open thực tế và phục hồi phiên.
- **Backend:** Chưa kết nối API đăng nhập, project, đồng bộ và xử lý trạng thái offline/online thực tế.
- **Kiểm thử tích hợp:** Chưa có kiểm thử đầy đủ với Worker, 3D, IndexedDB, API và dữ liệu CSV thật.
- **Tài liệu:** README và AI Prompting Log hiện là bản đầu, cần cập nhật theo mỗi lần tích hợp/kiểm thử thực tế.

## 4. Phụ thuộc cần phối hợp

- **CSV/Data Engine:** Xác nhận contract nhận file và tùy chọn, trả tiến độ/Dataset/cảnh báo/lỗi.
- **3D:** Xác nhận props đầu vào và callback chọn điểm (dựa trên `versionId`, `rowId`, `columnId`).
- **Storage:** Xác nhận giao diện Apply/Save, điều kiện commit local thành công, cách mở phiên và nhận lỗi.
- **Backend/API:** Cung cấp API request/response và mã lỗi cho Auth, Project, Sync.

Ưu tiên dùng `packages/contracts` và tài liệu kiến trúc hiện có làm chuẩn; mọi thay đổi contract cần thống nhất với người phụ trách trước khi tích hợp.

## 5. Kế hoạch tiếp theo

1. Chờ nhóm xác nhận contract/điểm kết nối, đồng thời tiếp tục rà soát UI và test độc lập.
2. Tích hợp CSV Worker thật để nhập file, tạo và hiển thị Dataset.
3. Kết nối scene 3D với bảng, Preview/Apply với xử lý thật và IndexedDB.
4. Tích hợp Save/Exit/Open, Auth/Project/Sync và các tình huống mất kết nối.
5. Bổ sung test cho luồng thực tế, cập nhật README/AI logs, gửi review/PR theo quy trình nhóm.

**Ghi chú Git:** Các bài test mới và báo cáo này đang được chuẩn bị để commit/push tiếp; chưa được xem là đã có trên GitHub cho đến khi push thành công.
