# Kiến trúc bản tích hợp

Ngày 10/11/2026, Asia/Saigon. Hai prompt gốc và baseline task 01 được giữ nguyên; tài liệu này mô tả mã hiện hành sau merge sáu nhánh thành viên.

## Ranh giới

- `packages/contracts`: Zod cho dataset, import, phiên, publication, auth, snapshot project và sync chunk.
- `packages/data-engine`: parser, suy luận bảo toàn số, thống kê và phép biến đổi thuần. `operations.ts` là hợp đồng cấu hình và pipeline thống nhất cho các mục xử lý. Các API engine/Worker cũ vẫn có tests tương thích.
- `apps/web/src/workers/product.worker.ts`: import, thống kê toàn bộ, preview; lưu import bằng IndexedDB trong Worker để giảm nghẽn UI. Thông điệp từ unknown được validate, có job ID, progress và lỗi. Hủy job tính toán bằng terminate, không công bố kết quả dở dang. Import chuyển sang giai đoạn commit ở progress 90%; UI ngừng cung cấp Hủy ở giai đoạn đó.
- `apps/web/src/app/App.tsx`: điều phối account, project, workspace, selection, preview và trạng thái lưu/sync; không parse CSV hoặc tự tạo kết quả xử lý.
- `Scene3D`: R3F/Three, instancing tối đa 1.500 đối tượng, OrbitControls, camera và stable selection. Có invalidate sau cập nhật instance matrices để dữ liệu và raycast xuất hiện đúng trong demand rendering.
- `storage/workspace.ts`: import, save, Apply, Undo và recovery. Dataset là snapshot bất biến theo version; source luôn được giữ. Workspace JSON lưu cấu hình từng chart, kết quả phân tích đã tính, camera, mục mở, undo stack và cấu hình import. Table filter/sort/selection dùng session contract.
- `modules/auth` và `modules/users`: repository MongoDB thật, scrypt, session token băm/HMAC, cookie HttpOnly, CSRF/Origin và giới hạn đăng nhập. Reservation rate-limit xảy ra trước lookup/hash; mutation sai CSRF không gia hạn idle; mật khẩu có surrogate lỗi bị chặn.
- `modules/projects`: một project–một nguồn–một phiên; quyền sở hữu ở mọi route. Chunk và operation ID unique theo owner; project ID unique; metadata không chứa cả dataset.

## Local commit và recovery

1. Engine tạo preview gắn base version và fingerprint cấu hình; preview không ghi history/outbox/current.
2. Apply tạo version mới, lưu chunk 1 MiB và manifest staging.
3. Trong transaction, publication xác minh manifest, sự tồn tại/thứ tự/kích thước/SHA-256 của từng chunk, parse nội dung và đối chiếu version ID.
4. Chỉ sau đó thêm version/history/outbox và chuyển current pointer/session. Crypto Promise giữ transaction sống bằng `Dexie.waitFor`; không bọc nested transaction trong một waitFor khác (tránh deadlock).
5. Ghi lỗi/quota/stale base làm abort, giữ current trước thao tác và preview để thử lại. Staging không được current/session tham chiếu không phải kết quả đã công bố.
6. Undo chuyển con trỏ về snapshot trước trong transaction và ghi history/outbox. Thứ tự lịch sử có sequence theo project, không dựa vào thứ tự UUID.
7. Mở phiên kiểm tra bytes/hash/schema/version; không công bố hoặc giả khôi phục một manifest hỏng. Khi mở chart, dùng result đã lưu; chỉ chart chưa tạo mới cần tính lần đầu.

Save/Exit kiểm tra phiên chưa đổi ở tab khác; lỗi không thoát. Camera/selection chưa lưu có thể mất nếu đóng tab đột ngột, như baseline. Dataset mới chỉ báo thành công sau commit hoàn chỉnh.

## Đồng bộ và publication Atlas

- `GET /projects`, `GET /projects/:id`, `GET /projects/:id/chunks/:chunkId` lọc owner từ session; tài nguyên người khác trả 404.
- `POST /sync/missing` nhận tối đa 200 chunk references, trả các chunk owner còn thiếu; retry chỉ upload phần còn thiếu.
- `PUT /sync/chunks/:chunkId` nhận tối đa một chunk 1 MiB (base64), xác minh SHA-256 và bytes, ghi immutable. Request body giới hạn 1.500.000 byte.
- `POST /sync/:id/commit` nhận operation ID, base revision và snapshot metadata (giới hạn 4 MB). Xác minh graph phiên bản/source/history/chart references và đủ nội dung mọi version trước publication.
- MongoDB transaction kiểm tra operation ledger và revision; ghi project pointer cùng ACK ledger. Mất ACK rồi gửi lại đúng operation/content trả lại revision đã commit, kể cả server có revision mới hơn. Reuse operation ID với nội dung khác bị chặn.
- Chunk không có endpoint sửa/xóa nên nội dung đã xác minh không thể bị thay đổi qua API giữa verify và publish.
- Client lưu job snapshot, operation ID, base revision và danh sách outbox được gom trước upload. ACK mới đánh dấu đúng các outbox đó synced; thay đổi local phát sinh trong lúc upload vẫn pending.
- Request nền gửi `x-session-activity: background`; thao tác người dùng hợp lệ có thể gia hạn idle. Retry có backoff 30–300 giây, online trở lại thử ngay. Lỗi một project không ngăn thử các project khác.
- Revision xung đột giữ nguyên job/outbox/local history và không ghi đè server. Người dùng có thể tạo project riêng từ kết quả local; project cũ vẫn giữ đủ nguồn và lịch sử.
- Download chỉ thay local khi không có pending và recheck trong transaction; kiểm tra bytes/hash của chunk trước ghi. Không thay ngầm workspace đang có thay đổi chưa lưu.

MongoDB cần replica set/Atlas để dùng transaction. `/health` kiểm tra ping khi project store đã cấu hình và tách `connected`/`unavailable`/`not-configured`; ping thành công vẫn không thay thế ACK publication.

## Offline và bảo mật

Build sinh service worker precache index, CSS, các chunks JS, scene lazy-load, Worker, manifest và icon. Chỉ cache tài nguyên tĩnh cùng origin, không cache `/api/`. Static cache bỏ qua `Vary: Origin` do server Vite thêm cho module requests; đây là nguyên nhân đã sửa trong ca offline reload. Bản cập nhật chờ các tab cũ đóng trước khi kích hoạt.

LocalStorage chỉ giữ PublicUser đã mở khóa và cờ thu hồi logout offline; không chứa password, session token hoặc MongoDB URI. API dùng cookie HttpOnly và kiểm tra ownership độc lập với identity local. Không trộn project các tài khoản. Logout offline còn pending bị chặn; logout online phải sync thành công hoặc người dùng xác nhận xóa local. Thu hồi offline được gửi trước login mới.

`.env` được Node nạp cho backend, bị Git bỏ qua. Không có memory store mặc định trong server production; các test doubles chỉ nằm ở test runner có nhãn. Xem README cho cách chạy và báo cáo nghiệm thu cho bằng chứng thực tế.

## Ngân sách và giới hạn đo được

- 1.500 đối tượng 3D; bảng chỉ dựng một trang 20 dòng. Thống kê toàn bộ, không âm thầm lấy mẫu xử lý.
- One-hot chặn trên 2.000.000 ô mới mỗi cột và giải thích số cột dự kiến; không gộp nhóm.
- Preview có thể truyền toàn bộ dataset qua structured clone; không tuyên bố bộ nhớ bị chặn theo kích thước một chunk. CSV 20 MB có thể mở rộng đáng kể trong RAM. Import/persist chạy Worker; Apply và recovery vẫn có các đoạn parse/validate phía UI. Các phép đo là một cấu trúc dữ liệu cụ thể, không bảo đảm cho mọi file.
- Histogram 20 bins; toàn bộ nhóm/cột vẫn được trình bày trong preview/mapping, scene giới hạn đối tượng có nhãn.
- Yeo–Johnson MLE: grid seed [-5,5], bước 0.05, golden-section tolerance 1e-6/tối đa 80 vòng; không hội tụ hoặc nghiệm ngoài miền tìm kiếm báo lỗi, không tự đổi lambda/scale.
- Ngày nhập nhằng và datetime không timezone bị chặn để tránh đoán sai; người dùng phải cung cấp biểu diễn ISO rõ ràng.
