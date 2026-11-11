# Dashboard 3D

Ứng dụng tiền xử lý CSV: **Đăng nhập → Tạo/mở project → Collection → Next → chọn điểm/ô 3D → Xem trước → Áp dụng → tự lưu → Thoát/Mở phiên**.

## Chạy dự án

Node **24.x**, npm **11.x**. Chạy lệnh tại thư mục gốc:

```powershell
npm ci
# Máy mới: sao chép .env.example thành .env và điền cấu hình backend.
npm run dev
```

Mở [http://localhost:4173](http://localhost:4173). Web gọi API qua `/api`; Fastify chạy ở cổng 3001. Đăng ký chỉ cần username/password; đăng ký thành công chuyển về đăng nhập. Không có chế độ khách, email, OTP hoặc đăng nhập giả.

Backend tự đọc `.env` ở root qua Node `--env-file-if-exists`. Cần `MONGODB_URI`, `MONGODB_DB_NAME`, `SESSION_SECRET` ít nhất 32 ký tự. `WEB_ORIGIN` mặc định `http://localhost:4173`. URI chỉ ở backend; không đưa vào `VITE_*`. Có thể đặt `MONGODB_DNS_SERVERS` nếu resolver hệ thống không phân giải được Atlas SRV; tùy chọn này chỉ ảnh hưởng tiến trình API. Atlas phải cho phép IP hiện tại trong Network Access.

Trên checkout tích hợp này, `.env` local đã được cấu hình từ credential có sẵn và được Git bỏ qua. Máy khác phải tự cấu hình. Không commit `.env` hoặc `atlas-credentials.env`.

Bản production local, dùng để kiểm tra offline:

```powershell
npm run build
npm start
```

Dừng dev trước khi chạy production, vì dùng cùng cổng. Chờ nhãn **Sẵn sàng offline** trước khi ngắt mạng. Cache gồm app shell, scene 3D và Worker; API/auth không được cache. Đóng các tab cũ rồi mở lại để kích hoạt một bản cập nhật đã tải xuống.

## Chức năng

- CSV UTF-8/BOM, dấu phẩy/chấm phẩy/tab, có/không header; tối đa **20.000.000 byte**. Header rỗng/trùng phải xác nhận tên đề xuất. Báo lỗi số cột và dòng nguồn; không bỏ các bản ghi quoted-empty. Số mất chính xác/mã có số 0 đầu và ngày được giữ text lúc nhập. Ô rỗng, khoảng trắng, null và N/A mặc định là giá trị thiếu; 0 và false được giữ.
- Collection giữ dữ liệu nguồn, thống kê toàn bộ: missing, trùng toàn dòng (đếm dòng dư), IQR k=1.5, phân vị tuyến tính, độ lệch chuẩn tổng thể, Pearson theo cặp hợp lệ. Cột hằng/không đủ cặp trả N/A. Có ma trận 3D và bảng thống kê chi tiết.
- Missing Values: Constant, Mean, Median, Mode Imputation; cấu hình phương pháp riêng từng cột. Mode đồng hạng lấy giá trị xuất hiện đầu. Sort chỉ phục vụ tính, giữ thứ tự đầu ra. Không ngoại suy; cột không đủ dữ liệu có cảnh báo/lỗi.
- Cleaning: tự xóa trùng khi vào tiền xử lý; trim, loại HTML, thay thế nhiều giá trị đồng thời, làm sạch theo cột, chuyển kiểu, đổi tên/xóa cột. Ngày yêu cầu ISO; datetime phải có timezone và chuyển UTC, không đoán ngày nhập nhằng.
- Outlier: IQR/Z-score, cấu hình ngưỡng, mặt phẳng biên, chỉ hiện ngoại lệ, xem trước kéo về biên hoặc xóa dòng. Chọn một điểm để xử lý riêng; chọn nhiều cột để xử lý hàng loạt.
- Scaling: Min–Max, Standard. Transformation: log1p, sqrt, không tự scale tiếp; sai miền/cột hằng chặn xử lý.
- Encoding: One-hot, Ordinal liệt kê nhóm thực tế và nhận thứ tự riêng từng cột. Preview tên/mapping; mặc định thay cột nguồn, có thể giữ. Missing phải xử lý trước hoặc chủ động tạo nhóm riêng. Không gộp nhóm ngầm.
- Biểu đồ gắn phiên bản nguồn, không tự chạy lại sau Apply/Undo; điểm trên chart cũ chỉ xem. Chạy lại cập nhật mục hiện tại. Có so sánh trước/sau, zoom/xoay, hover/click đồng bộ với bảng.
- IndexedDB lưu source/current/history/undo/cấu hình/chart result/camera/bộ lọc/sort/selection. Apply chỉ thành công sau khi xác minh chunk và transaction công bố version/history/current/outbox hoàn tất. Lưu lỗi giữ dữ liệu trước thao tác và cho thử lại. Thoát chờ lưu thành công.
- Tài khoản scrypt, cookie HttpOnly, CSRF/Origin/CORS, rate limit và ownership. Đồng bộ online tự động khi app mở, retry backoff hoặc Đồng bộ ngay; upload tiếp các chunk còn thiếu; SHA-256, operation ID ổn định, publication transaction MongoDB. Mất ACK không tạo bản sao. Revision xung đột giữ local, không ghi đè server; có thể lưu kết quả thành project riêng.
- Đăng xuất tuân theo pending/offline: offline còn pending bị chặn; online cho đồng bộ trước hoặc xác nhận xóa local. Sync lỗi không tự xóa dữ liệu. Thoát phiên giữ local và không đăng xuất.

## Kiểm tra

```powershell
npm run check
npm run format:check
npm run test:e2e
# Kiểm chứng UI production với Atlas thật (cần .env):
npm run test:e2e:atlas
```

E2E chạy **web production + API test server có memory stores được ghi nhãn trong `tests/support/api-server.ts`**. Test server không phải entrypoint production và không chứng minh Atlas. Chrome phải có sẵn; dừng các server dùng cổng 4173/3001 trước E2E.

Kiểm thử Atlas thật, chỉ tạo và dọn fixture của lần chạy trong database được cấp:

```powershell
# Dùng env file backend hợp lệ; script không in credential.
node --env-file=atlas-credentials.env --import tsx tests/support/run-atlas.ts
```

`MONGODB_TEST_DB_NAME` mặc định `dashboard_dev`. Dùng database thử nghiệm đã được cấp quyền. Không xóa database chung. Kết quả và giới hạn: [báo cáo tích hợp](docs/testing/integration-results.md).

## Kiến trúc và giới hạn

React/Vite/R3F/Three ở `apps/web`; CSV/thuật toán thuần ở `packages/data-engine`; Worker chạy nhập CSV, thống kê, preview và publication import; Dexie/IndexedDB ở `apps/web/src/storage`; Fastify/MongoDB ở `apps/api`; schema runtime dùng chung ở `packages/contracts`.

Scene vẽ toàn bộ dòng bằng instancing, cho chọn ba trục và tooltip theo con trỏ, bảng phân trang 20 dòng để giới hạn DOM; thống kê/xử lý vẫn dùng toàn bộ dữ liệu. Yeo–Johnson dùng MLE với grid khởi tạo [-5,5], golden-section tolerance 1e-6, tối đa 80 vòng tinh chỉnh; nghiệm ngoài khoảng/không tính được báo lỗi. One-hot có ngân sách 2.000.000 ô mới mỗi cột để tránh bùng bộ nhớ; giao diện báo số cột dự kiến khi vượt giới hạn. CSV gần 20 MB có thể chiếm nhiều RAM hơn kích thước file; xem phép đo cụ thể, không coi đó là cam kết cho mọi cấu trúc dữ liệu/máy.

Bản hiện tại dành cho chạy local; khi triển khai Internet cần HTTPS/reverse proxy, cấu hình `WEB_ORIGIN` và secret/backend env phù hợp. Không có xuất tệp, AI, SMTP/email/OTP, huấn luyện hoặc giao diện chỉnh sửa nhánh.

Hai prompt gốc được giữ tại [docs/prompt](docs/prompt/); các báo cáo thành viên và đánh giá là hồ sơ lịch sử trước tích hợp. Hướng dẫn vận hành hiện hành là README này và [kiến trúc tích hợp](docs/architecture/integration.md).
