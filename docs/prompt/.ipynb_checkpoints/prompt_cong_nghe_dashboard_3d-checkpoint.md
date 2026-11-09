# Prompt lựa chọn công nghệ và tổ chức triển khai Dashboard 3D

Bạn là kiến trúc sư phần mềm hỗ trợ nhóm sinh viên xây dựng đề tài “Hệ thống dashboard tương tác 3D quản lý và trực quan hóa quy trình khai phá dữ liệu”. Hãy hoàn thiện đặc tả công nghệ và kế hoạch triển khai dựa trên các quyết định dưới đây.

## Quy tắc sử dụng chung hai tài liệu

Hai prompt là một bộ đặc tả bổ trợ nhau:
- **Prompt chức năng và tương tác** quyết định màn hình, biểu đồ, nút, phương pháp và phạm vi xử lý, xem trước, hoàn tác, lịch sử và hành vi phiên làm việc.
- **Prompt công nghệ và tổ chức triển khai** quyết định stack, Worker, lưu trữ, API, tài khoản, offline, đồng bộ và yêu cầu kỹ thuật/hiệu năng. Tài liệu này cũng là nguồn quy định hành vi tài khoản, offline và đồng bộ, thay vì tự thêm các quy tắc đó vào luồng tiền xử lý.
- Các quy tắc chung ở hai tài liệu phải cùng nghĩa. Khi cần mô tả chi tiết, dẫn chiếu tài liệu sở hữu thay vì tạo một biến thể mới. Không dùng nguyên tắc “tệp đọc sau thắng” hoặc “tệp mới hơn thắng” để âm thầm bỏ yêu cầu.
- Nếu gặp mâu thuẫn thực sự còn lại, ghi rõ hai yêu cầu liên quan, tiếp tục phần độc lập và chỉ hỏi khi quyết định đó ngăn cản công việc.
- Nhiệm vụ giao agent trong từng lần quyết định chỉ thiết kế hay được triển khai, phạm vi sửa và kết quả cần bàn giao. Bản thân hai tài liệu không tự cấp lệnh cài đặt, kết nối/chỉnh sửa Atlas hay triển khai ứng dụng.
- Nếu chỉ nhận hai prompt mà chưa có nhiệm vụ thực thi: mặc định đối chiếu hiện trạng và lập thiết kế/kế hoạch, chưa sửa mã hoặc cài dependency. Khi được giao triển khai rõ ràng, thực hiện phần được giao theo cả hai tài liệu; không bị chặn bởi câu “mặc định chỉ thiết kế”.
- Không tự khôi phục yêu cầu từ thiết kế cũ ngoài bộ tài liệu hiện tại. Phân biệt rõ yêu cầu đã chốt với thư viện, tham số hoặc chi tiết còn được đánh dấu là đề xuất.

## 1. Cách thực hiện nhiệm vụ

- Đọc cả hai prompt và tài liệu/mã nguồn hiện có nếu được cung cấp; đối chiếu trước khi thiết kế hoặc sửa mã.
- Nếu được giao lập đặc tả: trình bày bảng công nghệ, trách nhiệm thành phần, module, cấu trúc thư mục, luồng dữ liệu và tiêu chí nghiệm thu; chưa cài dependency hoặc kết nối/chỉnh sửa Atlas.
- Nếu được giao triển khai: thực hiện chức năng trong phạm vi được giao theo cả hai prompt; không tự coi lần giao tài liệu là lệnh triển khai toàn bộ.
- Chỉ hỏi khi thiếu thông tin thực sự ngăn cản công việc; ghi lựa chọn nhỏ thành giả định/đề xuất rõ ràng. Không sửa hành vi sản phẩm để thuận tiện chọn thư viện.

## 2. Mục tiêu và ràng buộc đã chốt

- Đây là đồ án môn lập trình: tập trung kiến trúc, luồng xử lý, tính đúng đắn, khả năng phục hồi, trải nghiệm và hiệu năng. Phần thuật toán phục vụ minh họa quy trình, không mở rộng thành nghiên cứu ML.
- Toàn bộ mã ứng dụng, bộ xử lý và kiểm thử dùng JavaScript/TypeScript; ưu tiên TypeScript. Không dùng Python hoặc backend xử lý Python, kể cả dịch vụ Python ẩn phía sau.
- Không dùng kiểu `any` trong mã nhóm viết. Không sửa mã thư viện bên thứ ba để loại bỏ `any` nội bộ của thư viện.
- Frontend: React + Vite + TypeScript + Three.js + React Three Fiber.
- Backend: Node.js + Fastify + TypeScript, kiến trúc Modular Monolith.
- Cơ sở dữ liệu backend: MongoDB Atlas.
- Dữ liệu đầu vào: chỉ CSV, tối đa 20.000.000 byte (20 MB thập phân) mỗi tệp. Không thêm nhập Excel/JSON; không dùng giới hạn tệp nhập để âm thầm cắt kết quả One-hot.
- Luồng nghiệp vụ Collection → Pre-processing theo prompt chức năng. Có các màn hình hỗ trợ đăng ký/đăng nhập và danh sách project/phiên. Không tạo bản đồ điều hướng quy trình 3D.
- Một tài khoản sở hữu nhiều project độc lập. Mỗi project có đúng một dataset nguồn và một phiên làm việc tiếp tục được; dataset có nhiều phiên bản. Phân biệt phiên làm việc với phiên đăng nhập.
- Tự lưu local sau mỗi Áp dụng thành công; nút Lưu phiên và Thoát phiên lưu trạng thái bổ sung. Không có xuất tệp, kể cả xuất cứu hộ.
- Đọc CSV, xử lý dữ liệu, thống kê và tính toán thuật toán thuộc phạm vi đã được đặc tả chạy trong trình duyệt bằng Web Worker.
- Bản đầu chạy frontend và backend trên localhost; MongoDB Atlas cần Internet. Localhost không có nghĩa toàn bộ hệ thống không cần Internet.
- Có offline sau khi tài nguyên cần thiết đã được cache: nhập/xử lý CSV, biểu đồ 3D tương tác, phóng to/chọn điểm/bảng nổi, bảng dữ liệu, lưu và mở lại trạng thái đã có trên trình duyệt đó. Không thay bằng ảnh tĩnh. Biểu đồ chỉ tính lại khi người dùng yêu cầu theo prompt chức năng, cả online lẫn offline.
- Tự đồng bộ khi kết nối trở lại và ứng dụng đang mở; có nút đồng bộ ngay và thử lại khi lỗi. Không hứa đồng bộ chắc chắn khi tab đã đóng.
- Tài khoản bản đầu chỉ cần tên đăng nhập và mật khẩu. Đăng ký hợp lệ tạo tài khoản sử dụng ngay; đăng nhập đúng tên và mật khẩu thì truy cập hệ thống. Không yêu cầu email hoặc xác minh danh tính.
- Loại khỏi phạm vi bản đầu: AI, chatbot/RAG, API key AI, SMTP, gửi email, OTP, xác minh email và luồng quên/đặt lại mật khẩu. Không tạo module, giao diện, dependency hoặc biến môi trường cho các chức năng này.
- Cấu trúc thư mục rõ ràng, thuận lợi phân công nhóm; ưu tiên hoàn thiện luồng đầu cuối trước khi mở rộng.

## 3. Công nghệ đã chốt và thư viện đề xuất

Không tự thay framework hay chuyển sang Next.js/microservices. Các thư viện bổ sung dưới đây là đề xuất: kiểm tra tính tương thích, giấy phép và độ phù hợp trước khi quyết định; không mặc định cài tất cả.

| Lớp | Công nghệ | Trạng thái / mục đích |
| --- | --- | --- |
| Frontend | React, Vite, TypeScript | Đã chốt |
| 3D | Three.js, React Three Fiber | Đã chốt |
| Backend | Node.js, Fastify, TypeScript | Đã chốt |
| Kiến trúc backend | Modular Monolith | Đã chốt, một ứng dụng triển khai chung |
| Database | MongoDB Atlas | Đã chốt |
| Xử lý nền | Web Worker | Đã chốt |
| Driver MongoDB | MongoDB Node.js Driver | Đề xuất; ưu tiên truy cập rõ ràng, không cần thêm ODM nếu chưa có lý do |
| Lưu offline | IndexedDB + Dexie.js | Đề xuất, tách biệt với MongoDB |
| Cache giao diện | vite-plugin-pwa / Workbox | Đề xuất; phải cache đủ tài nguyên cần dùng offline |
| Đọc CSV | Papa Parse | Đề xuất, xử lý theo chunk trong Worker; tránh chồng Worker không cần thiết |
| Kiểm tra runtime | Zod | Đề xuất, schema cho API, cấu hình thao tác, thông điệp Worker và dữ liệu lưu |
| Điều hướng | React Router | Đề xuất nếu có nhiều trang |
| Trạng thái UI | React state/context trước; Zustand nếu cần | Không đưa dataset lớn vào state toàn cục |
| Bảng lớn | TanStack Virtual | Đề xuất ảo hóa dòng; nếu cần ảo hóa cả cột phải đánh giá thêm |
| Biểu đồ | Chọn một thư viện biểu đồ chính sau khi đối chiếu loại biểu đồ | Phục vụ đúng các biểu đồ dữ liệu trong prompt chức năng; không tạo bản đồ quy trình. Ưu tiên dùng Three.js/R3F đã chốt cho cảnh 3D. Chỉ đề xuất Plotly.js nếu có lợi ích rõ, nêu phần phụ trách, chi phí bundle và khả năng chọn điểm/tooltip; không dựng trùng hai bộ render cho cùng biểu đồ |
| Kiểm soát mã | ESLint + typescript-eslint, Prettier | Đề xuất |
| Kiểm thử | Vitest + Playwright | Đề xuất, kiểm thử nghiệp vụ và luồng quan trọng |
| Quản lý repository | npm workspaces | Đề xuất một repository, dùng lockfile |

Chọn Node.js LTS và các phiên bản ổn định tương thích tại thời điểm triển khai; kiểm tra peer dependencies của React, Three.js và React Three Fiber. Không lấy bản alpha/canary làm mặc định. Không mặc định mọi dịch vụ bên ngoài miễn phí; nêu nhu cầu cấu hình tài khoản, hạn mức và chi phí có thể có.

## 4. Modular Monolith và ranh giới module

Backend là một ứng dụng Fastify, một đơn vị triển khai. Chia theo nghiệp vụ, không tạo nhiều dịch vụ chạy riêng chỉ để giống microservices.

| Module | Trách nhiệm |
| --- | --- |
| auth | Đăng ký bằng tên đăng nhập và mật khẩu, đăng nhập, đăng xuất và quản lý phiên xác thực |
| users | Thông tin tài khoản và tên hiển thị |
| projects | Dự án và quan hệ sở hữu; mỗi project có một dataset nguồn và một phiên làm việc |
| datasets | Metadata, dữ liệu gốc và nội dung dữ liệu |
| versions | Phiên bản dữ liệu, quan hệ cha-con, con trỏ hiện tại, hoàn tác và truy xuất kết quả; chưa có trình chỉnh sửa nhánh/phiên bản cũ |
| sessions | Phiên làm việc theo project và khôi phục trạng thái; không nhầm với phiên xác thực thuộc auth |
| charts | Cấu hình và kết quả cần để hiển thị lại biểu đồ |
| sync | Nhận thay đổi offline, chống trùng lặp và điều phối đồng bộ |

- Điều chỉnh cách gộp module nếu cần nhưng giải thích lý do; không tách quá nhỏ.
- Trong mỗi module, chỉ tạo các lớp routes, schemas, services và repositories khi có trách nhiệm thực tế. Không tạo hàng loạt file rỗng theo mẫu.
- Mỗi collection có module sở hữu. Module khác gọi giao diện công khai của module đó; không tự ý cập nhật collection của nhau.
- Không tạo phụ thuộc vòng. Module sync gọi giao diện nghiệp vụ để áp dụng thay đổi; không bỏ qua kiểm tra quyền và quy tắc phiên bản.
- Phần shared chỉ chứa thành phần dùng chung thực sự. Không dồn toàn bộ logic vào shared/utils.

## 5. Cấu trúc thư mục đề xuất

Trình bày cây thư mục chính thức trong kết quả. Có thể bắt đầu từ các đường dẫn sau:

| Đường dẫn | Nội dung |
| --- | --- |
| apps/web/src/app | Khởi tạo app, router, providers |
| apps/web/src/features | Tính năng UI theo nghiệp vụ |
| apps/web/src/scene | Cảnh, đối tượng và tương tác biểu đồ dữ liệu 3D; không có bản đồ quy trình riêng |
| apps/web/src/workers | Worker và cầu nối thông điệp có kiểu |
| apps/web/src/storage | IndexedDB, giao dịch local, nâng cấp schema |
| apps/web/src/sync | Hàng đợi và điều phối đồng bộ phía client |
| apps/web/src/components | Component UI dùng chung |
| apps/api/src/modules | Các module nghiệp vụ backend |
| apps/api/src/plugins | Database, cookie, logging và middleware/plugin chung |
| apps/api/src/config | Đọc và kiểm tra biến môi trường |
| packages/contracts | Kiểu và schema trao đổi frontend/backend/Worker |
| packages/data-engine | Hàm xử lý dữ liệu thuần TypeScript |
| tests/e2e | Kiểm thử luồng người dùng |
| docs | Kiến trúc, API, thiết lập, hiệu năng và quyết định công nghệ |

packages/data-engine không phụ thuộc React, DOM hoặc MongoDB. Không xuất mã backend hoặc bí mật qua package dùng chung. Monorepo là cách quản lý mã, không đồng nghĩa microservices.

## 6. TypeScript và kiểm tra đầu vào

- Bật strict, noImplicitAny, noUncheckedIndexedAccess và exactOptionalPropertyTypes; xác minh tác động tương thích trước khi chốt cấu hình.
- ESLint chặn no-explicit-any và nhóm no-unsafe-* với cấu hình type-aware. Không dùng ts-ignore, ép kiểu kép hoặc tắt lint để lách lỗi kiểu.
- Dùng unknown cho dữ liệu chưa tin cậy, sau đó parse/validate; không dùng ép kiểu thay cho kiểm tra runtime.
- Khai báo kiểu ô dữ liệu rõ ràng, ví dụ string | number | boolean | null; ngày tháng có biểu diễn chuẩn được đặc tả. Kiểm soát NaN, Infinity và chuyển đổi số làm mất độ chính xác.
- Không suy diễn việc không nhập file JSON thành cấm JSON trong API hay cấu hình nội bộ.
- Kiểm tra kích thước tệp, header, cột trùng tên, dòng sai số cột, encoding/delimiter, giá trị thiếu và điều kiện áp dụng thao tác.
- Giới hạn CSV đã chốt: 20.000.000 byte. Kiểm tra trước khi parse và thông báo rõ khi vượt giới hạn; công bố đây là MB thập phân.
- Giới hạn dòng/cột và độ dài ô phải có cơ sở tài nguyên; không tự áp lại mốc 50.000 dòng/50 cột vì người dùng chỉ chốt kích thước tệp.
- Chạy kiểm tra kiểu riêng bằng tsc --noEmit hoặc chế độ build project references tương ứng; không coi vite build hay Vitest chạy được là bằng chứng không có lỗi kiểu.

## 7. Luồng xử lý và hiệu năng

1. Người dùng đăng nhập hoặc mở không gian làm việc offline hợp lệ, tạo/mở project và phiên.
2. Khi nhập CSV: kiểm tra đầu vào, Worker đọc theo chunk, tạo schema và bản xem trước giới hạn; lưu raw và metadata local nhất quán.
3. Người dùng chọn thao tác trên phiên bản hiện tại, cấu hình và nhấn Xem trước. Worker chạy có jobId, tiến độ và hủy tác vụ; chưa cập nhật con trỏ hiện tại hoặc đồng bộ bản xem trước.
4. Áp dụng xác nhận kết quả xem trước còn khớp dữ liệu/cấu hình. Lưu dữ liệu hoàn chỉnh, metadata phiên bản, lịch sử, con trỏ hiện tại và outbox theo một ranh giới công bố local nhất quán.
5. Chỉ sau khi lưu local thành công, báo Áp dụng thành công/Đã lưu trên máy. Lỗi lưu giữ phiên bản trước; không công bố kết quả dở dang. Nếu nội dung ghi theo nhiều chunk, chỉ công bố sau khi toàn bộ chunk và manifest hợp lệ; không bắt buộc dồn toàn bộ byte vào một transaction khổng lồ.
6. UI cập nhật bảng dữ liệu, lịch sử và trạng thái lưu. Không tự tính lại biểu đồ/thống kê cũ; giữ liên kết phiên bản theo prompt chức năng. Xem trước có biểu đồ so sánh riêng theo yêu cầu người dùng.
7. Khi backend và Atlas sẵn sàng, tự đồng bộ kết quả đã công bố, nhận xác nhận rồi đổi trạng thái đồng bộ. Có Đồng bộ ngay/Thử lại.
8. Lưu phiên lưu thêm cấu hình và trạng thái giao diện; Thoát phiên chờ lưu thành công rồi về danh sách, không đăng xuất và không xóa local.

- Worker chỉ sửa dữ liệu trên phiên bản hiện tại. Biểu đồ phiên bản cũ chỉ đọc; yêu cầu chạy lại trên dữ liệu hiện tại trước khi sửa. Không xây giao diện chọn phiên bản cũ/tạo nhánh nếu chưa được giao thêm.
- Hoàn tác khôi phục trạng thái trước thao tác theo prompt chức năng; việc đổi con trỏ hiện tại và lịch sử/metadata liên quan phải được lưu và đồng bộ nhất quán, không xóa mất raw hoặc các biểu đồ đã tham chiếu.

- Không xử lý nặng trên main thread; kiểm soát số Worker và tác vụ đồng thời.
- Không structured-clone toàn bộ dataset liên tục; dùng chunk/Transferable khi định dạng phù hợp và quản lý rõ quyền sở hữu buffer.
- Truyền dữ liệu có backpressure, tránh đọc nhanh hơn khả năng xử lý/lưu.
- Khi hủy hoặc lỗi, không công bố phiên bản chưa hoàn chỉnh và không làm mất phiên bản trước.
- Tách trạng thái UI khỏi dữ liệu lớn; bảng dùng ảo hóa, biểu đồ lấy mẫu hiển thị và nói rõ khi có lấy mẫu. Các phép tính không tự ý dùng mẫu thay dữ liệu đầy đủ.
- Tải phần 3D và thư viện biểu đồ theo nhu cầu; giới hạn draw calls, số điểm và cập nhật React theo khung hình.
- Hiệu năng phải đo trên dữ liệu đại diện. CSV 20 MB có thể chiếm nhiều RAM hơn khi parse; không cam kết thời gian hoặc bộ nhớ khi chưa đo.
- Ghi thời gian parse/xử lý/lưu/đồng bộ, độ phản hồi UI và các giới hạn đo bộ nhớ của trình duyệt. Đưa ngân sách hiệu năng thành đề xuất, không giả làm kết quả thực nghiệm.

## 8. Lưu MongoDB Atlas và đồng bộ

- MongoDB lưu thông tin dự án, metadata dataset, dữ liệu gốc, dữ liệu sau xử lý, phiên bản, phiên làm việc, cấu hình biểu đồ và bản ghi cần cho đồng bộ.
- Không lưu cả dataset vào một BSON document. MongoDB có giới hạn 16 MiB/document; thiết kế chunk hoặc GridFS cho nội dung lớn, metadata riêng. Chọn một phương án chính và giải thích.
- MONGODB_URI chỉ ở backend .env; không đưa vào VITE_* hoặc bundle frontend. Có .env.example với placeholder, gitignore và log che bí mật.
- IndexedDB là nơi lưu local, MongoDB Atlas là nơi lưu backend; đây không phải cơ chế sao chép tự động có sẵn giữa hai database.
- Local commit gồm dữ liệu hoàn chỉnh và outbox tương ứng. Mỗi lần đồng bộ có operationId ổn định, unique index hoặc cơ chế tương đương để retry không tạo bản sao.
- Gửi theo lô/chunk với giới hạn kích thước, concurrency và retry backoff; API body limit phù hợp kích thước chunk. Không phải nâng toàn bộ request lên 20 MB.
- Chỉ báo “Đã đồng bộ” sau khi backend xác nhận đủ nội dung và metadata đã được công bố thành công. Khi mất phản hồi sau khi server ghi, retry phải nhận lại kết quả đã ghi.
- Phân biệt có Internet, gọi được backend và backend ghi được Atlas. Không chỉ dựa vào navigator.onLine hoặc một endpoint health không kiểm tra database.
- Dữ liệu xung đột giữ thành phiên bản riêng, ghi quan hệ cha/base revision; không âm thầm ghi đè. Đây là bảo toàn dữ liệu trong cơ chế sync, không tự mở rộng thành UI cây nhánh/chọn phiên bản để chỉnh sửa. Thông báo trạng thái xung đột và giữ riêng kết quả local để không mất dữ liệu.
- Bản đầu chưa có xóa project/dataset/phiên qua UI. Xóa dòng/cột là thao tác tạo phiên bản mới. Mô tả xung đột metadata/con trỏ hiện tại và dữ liệu sau xử lý; không thêm quy trình xóa tài nguyên ngoài phạm vi.
- Không đánh dấu dữ liệu đồng bộ chỉ vì đã gửi request. Lỗi hoặc hết phiên đăng nhập phải giữ nguyên dữ liệu local và outbox, chờ đăng nhập lại để tiếp tục.
- Kiểm tra userId/projectId ở backend trên mọi tài nguyên; không tin quyền sở hữu do client gửi lên.

## 9. Offline và tài khoản

- Cache app shell, Worker, thư viện lazy-load cần thiết, font/icon và tài nguyên cần dùng. Không dựa vào CDN trong luồng offline.
- Kiểm tra bằng bản build production được phục vụ qua localhost với origin ổn định, không chỉ Vite dev server.
- Người dùng đăng nhập online ít nhất một lần trên trình duyệt trước khi dùng không gian làm việc tài khoản offline. Offline không xác thực mới với máy chủ.
- Nếu phiên hết hạn khi offline, vẫn cho làm việc với dữ liệu local của người dùng đã mở khóa trước đó; kết nối lại phải xác thực trước khi đồng bộ. Không coi trạng thái local là quyền truy cập API.
- Chỉ mở được dữ liệu đã tải hoặc tạo và lưu trên trình duyệt đó; không hứa dữ liệu cloud chưa tải sẽ có offline.
- Hiển thị “Đã lưu trên máy”, “Chưa đồng bộ”, “Đang đồng bộ”, “Đã đồng bộ” và lỗi có thể thử lại.
- Xử lý quota/lỗi lưu local: không báo đã lưu hoặc Áp dụng thành công khi ghi thất bại; giữ phiên bản trước và giữ bản xem trước còn trong bộ nhớ khi có thể để thử lại. Không tự thoát, xóa dữ liệu hoặc cung cấp xuất tệp cứu hộ. Hiển thị Lưu lỗi và Thử lưu lại. Trình bày giới hạn lưu trữ trình duyệt, đề xuất persistent storage khi phù hợp; không hứa dữ liệu chưa lưu sẽ sống qua đóng tab.
- Tự lưu sau mỗi Áp dụng là chính sách đã chốt. Khi đóng tab đột ngột chỉ bảo đảm khôi phục lần lưu hoàn chỉnh gần nhất; không dựa vào unload để bảo đảm lần ghi cuối.
- Thoát phiên làm việc chỉ lưu rồi về danh sách; chính sách xóa local dưới đây chỉ dành cho Đăng xuất tài khoản.
- Đăng ký và đăng nhập mới cần backend kết nối được MongoDB Atlas. Khi mất kết nối, không tự tạo tài khoản tạm hoặc giả lập đăng nhập thành công; vẫn cho tiếp tục không gian làm việc local đã mở trước đó theo quy tắc offline.
- Form đăng ký chỉ có tên đăng nhập và mật khẩu; form đăng nhập dùng đúng hai thông tin này. Không yêu cầu email, số điện thoại hoặc mã xác minh.
- Tên đăng nhập là username duy nhất, tách biệt với tên hiển thị. Đề xuất chuẩn hóa bằng trim và so khớp không phân biệt hoa/thường; mô tả rõ quy tắc ký tự và độ dài. Dùng unique index trên tên chuẩn hóa để chống đăng ký trùng, kể cả hai request đồng thời. Không tự trim hoặc đổi chữ hoa/thường của mật khẩu.
- Kiểm tra đầu vào tên và mật khẩu ở backend, trả lỗi rõ khi thiếu/sai định dạng hoặc tên đã tồn tại. Đề xuất ngưỡng độ dài hợp lý; không thêm xác minh ngoài hai trường đã chốt.
- Đăng ký thành công tạo tài khoản hoạt động ngay, sau đó chuyển tới trang đăng nhập. Đăng nhập kiểm tra mật khẩu đã băm; thành công tạo phiên và mở hệ thống, thất bại không cấp phiên.
- “Chưa cần xác thực” ở đây nghĩa là không xác minh email/OTP; vẫn phải kiểm tra thông tin đăng nhập, bảo vệ API và kiểm tra quyền sở hữu dữ liệu. Không lưu mật khẩu dạng thô, không log mật khẩu và không trả passwordHash về frontend.
- Mật khẩu băm bằng thuật toán phù hợp; đề xuất dùng scrypt của Node.js hoặc thư viện Argon2 tương thích, giải thích lựa chọn. Không tự viết thuật toán mật mã.
- Đề xuất session/cookie HttpOnly và chính sách CSRF/CORS phù hợp localhost và triển khai HTTPS sau này; không dùng token trong localStorage làm mặc định.
- Giữ quy tắc đăng xuất đã thống nhất: offline có dữ liệu chưa đồng bộ thì chặn; offline không có dữ liệu chờ thì cho đăng xuất và xóa dữ liệu local của tài khoản, ghi nhận thu hồi phiên để gửi khi có kết nối; online cho chọn đồng bộ trước hoặc vẫn đăng xuất và xóa dữ liệu chưa đồng bộ sau xác nhận rõ ràng. Đồng bộ thất bại không tự xóa dữ liệu.
- Không trộn dữ liệu local giữa các tài khoản. Nếu còn quy tắc phiên/thiết bị trong tài liệu nghiệp vụ, giữ nguyên và đối chiếu rõ.

## 10. Kiểm thử và tiêu chí nghiệm thu

Đề xuất kiểm thử có ý nghĩa, tránh sinh hàng nghìn file bằng chứng hoặc lặp test khi không có thay đổi mới.

- Typecheck, lint, unit tests của data-engine, integration tests của API/storage và Playwright cho luồng đầu cuối.
- CSV hợp lệ nhỏ và gần 20 MB; quá giới hạn; CSV có cột/dòng lỗi; kết quả xử lý đối chiếu fixture kỳ vọng.
- Hủy tác vụ, lỗi Worker, lỗi IndexedDB, quota, đóng/mở lại cùng origin; phiên bản trước vẫn nguyên vẹn.
- Đã chuẩn bị offline, mất kết nối, nhập/xử lý CSV, phóng to/chọn điểm/bảng nổi trên biểu đồ 3D, lưu và mở lại. Kiểm tra cache đủ Worker và tài nguyên lazy-load cần thiết.
- Xem trước không commit dữ liệu chính/outbox; Áp dụng chỉ thành công sau local commit. Lỗi quota không đổi con trỏ hiện tại, không tự xuất cứu hộ. Lưu/thoát/mở lại giữ đủ trạng thái.
- Biểu đồ cũ giữ đúng phiên bản sau Áp dụng/hoàn tác; chỉ Chạy lại mới tính lại, nhấn điểm cũ không sửa dữ liệu hiện tại.
- Kiểm thử quan hệ một project–một dataset nguồn–một phiên làm việc; không tạo bản đồ quy trình hoặc UI chỉnh sửa nhánh.
- Khôi phục kết nối tự đồng bộ; gửi lặp; mất ACK sau server commit; hết phiên; Atlas không truy cập được dù backend còn chạy; xung đột phiên bản.
- Đăng ký chỉ bằng tên và mật khẩu; tên trùng sau chuẩn hóa, hai request đăng ký trùng đồng thời, đầu vào thiếu/sai; tài khoản mới dùng được ngay.
- Đăng nhập đúng thông tin truy cập được hệ thống; sai tên/mật khẩu bị từ chối. Kiểm tra phiên hết hạn, đăng xuất, API chưa đăng nhập, phân tách dữ liệu người dùng và giới hạn thử đăng nhập.
- Mật khẩu chỉ lưu hash và salt thích hợp, không xuất hiện trong log hoặc response; không có giao diện/endpoint phụ thuộc dịch vụ email hay gợi ý tự động đã loại bỏ.
- Nếu Atlas chưa có kết nối/credential hợp lệ, ghi blocked/not verified cho tích hợp thật; dùng test double có nhãn cho kiểm thử nội bộ, không báo đã lưu Atlas thật.
- Báo cáo kết quả expected/actual, lệnh tái hiện, phiên bản môi trường và thời gian xử lý; không báo đạt hiệu năng khi chưa đo.

## 11. Đầu ra yêu cầu

1. Tóm tắt kiến trúc và trách nhiệm browser/Worker/backend/Atlas.
2. Bảng công nghệ: đã chốt / đề xuất, phiên bản tương thích dự kiến, lý do, vai trò offline và chi phí cấu hình.
3. Cấu trúc thư mục và quy tắc phụ thuộc module.
4. Luồng nhập CSV, xử lý, lưu phiên bản, mở lại và đồng bộ; nêu các điểm commit và xử lý lỗi.
5. Thiết kế lưu trữ raw/processed/metadata và idempotency tối thiểu.
6. Danh mục biến môi trường chỉ chứa tên và placeholder: MongoDB, session secret, port và cấu hình origin cần thiết; không in bí mật thật.
7. Danh sách script dự kiến cho dev/build/start/typecheck/lint/test/e2e, giải thích dev và bản chạy kiểm chứng offline.
8. Kế hoạch triển khai theo lát chức năng đầu cuối: đăng ký/đăng nhập → tạo/mở project và phiên → nhập CSV → xem trước → Áp dụng và tự lưu → Thoát/Mở phiên → offline 3D tương tác → đồng bộ. Kế hoạch không thay thế lệnh triển khai cụ thể.
9. Ma trận nghiệm thu và các dữ kiện cần bổ sung khi tích hợp Atlas thật; nêu rõ đăng ký sử dụng ngay không qua bước xác minh.

Không bổ sung Kubernetes, Kafka, Redis, API gateway, microservices hoặc Docker bắt buộc khi chưa có nhu cầu cụ thể. Chỉ đưa công nghệ vào khi giải quyết được yêu cầu đã chốt.

## Tài liệu chính thức để kiểm chứng lựa chọn

- Vite: https://vite.dev/guide/ và https://vite.dev/guide/features
- React Three Fiber: https://r3f.docs.pmnd.rs/
- Fastify: https://fastify.dev/docs/latest/
- MongoDB GridFS: https://www.mongodb.com/docs/manual/core/gridfs/
- Dexie: https://dexie.org/docs/
- Vite PWA: https://vite-pwa-org.netlify.app/guide/
- Papa Parse: https://www.papaparse.com/docs
- TypeScript ESLint: https://typescript-eslint.io/blog/avoiding-anys/
- Zod: https://zod.dev/basics
- Plotly.js: https://plotly.com/javascript/

Các URL là nguồn kiểm chứng, không yêu cầu cài tất cả thư viện được liệt kê. Kiểm tra lại phiên bản và tương thích trước khi triển khai.
