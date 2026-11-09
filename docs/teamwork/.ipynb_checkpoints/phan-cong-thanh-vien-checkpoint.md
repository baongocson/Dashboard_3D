# Phân công thực hiện Dashboard 3D

Ngày soạn: 06/11/2026. Tài liệu giao việc cho Phát, Nga, Phúc, Tuấn, Trâm và Nguyên, theo cơ cấu 2 frontend, 2 backend, 1 database, 1 xử lý dữ liệu.

Đây là tài liệu phân công chính của nhóm. Kế hoạch 6 ngày cũ đã được bỏ; vai trò, phạm vi và cách phối hợp được cập nhật tại đây.

## 1. Dự án, thư mục và nhánh làm việc

Nhóm cùng phát triển **một dự án, một repository**. Mỗi thành viên clone repository vào máy mình; không cần dùng chung đường dẫn tuyệt đối. Trên máy hiện tại, thư mục gốc là `D:\JS_TS\dashboard_3d`.

| Thành viên | Vai trò                    | Nhánh Git đã đặt tên              | Thư mục chính, tính từ gốc repository                                                 |
| ---------- | -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| Phát       | Frontend giao diện         | `codex/phat-frontend-ui`          | `apps/web/src/features`, `apps/web/src/components`                                    |
| Nga        | Frontend 3D                | `codex/nga-frontend-3d`           | `apps/web/src/scene`, `tests/e2e` cho tương tác 3D                                    |
| Phúc       | Backend tài khoản          | `codex/phuc-backend-auth`         | `apps/api/src/modules/auth`, `apps/api/src/modules/users`                             |
| Tuấn       | Backend dữ liệu và đồng bộ | `codex/tuan-backend-data-sync`    | `apps/api/src/modules/projects`, `datasets`, `versions`, `sessions`, `charts`, `sync` |
| Trâm       | Database và lưu local      | `codex/tram-database-storage`     | `apps/api/src/plugins`, `apps/api/src/config`, `apps/web/src/storage`                 |
| Nguyên     | Xử lý dữ liệu và Worker    | `codex/nguyen-data-engine-worker` | `packages/data-engine/src`, `apps/web/src/workers`                                    |

Các nhánh trên là tên được chuẩn bị để thành viên sử dụng, **chưa được tạo hoặc push bằng tài liệu này**. Những thư mục chưa tồn tại chỉ tạo khi có mã thực tế, không tạo hàng loạt module rỗng. Với Tuấn, các tên thư mục rút gọn trong bảng đều nằm dưới `apps/api/src/modules/`.

## 2. Chuẩn bị chung trước khi viết tính năng

1. Đọc `docs/prompt/`, `docs/architecture/task-01-decisions.md` và `docs/architecture/foundation.md` để hiểu yêu cầu và phần nền tảng đã có.
2. Dùng Node 24 và npm 11 theo `package.json`. Tại thư mục gốc, chạy `npm ci`, sau đó `npm run dev`.
3. Kiểm tra web tại `http://localhost:4173` và API tại `http://localhost:3001/health`. Health hiện chỉ là liveness, không chứng minh MongoDB sẵn sàng.
4. Nhánh tích hợp hiện tại là `main` trên remote `origin`. Thành viên tạo nhánh cá nhân từ `main` đã cập nhật và mở PR vào `main`.
5. Chốt schema và ví dụ request/response hoặc thông điệp Worker trước khi làm hai phía. Ưu tiên dùng schema sẵn trong `packages/contracts/src/index.ts`.

Tại **bản clone riêng của từng người**, khi working tree sạch:

```powershell
git status
git fetch origin
git switch main
git pull --ff-only origin main
# Ví dụ cho Phát; người khác thay bằng nhánh trong bảng.
git switch -c codex/phat-frontend-ui
```

Nếu nhánh cá nhân đã tồn tại, dùng `git switch <ten-nhanh>` thay vì `git switch -c`. Nếu có thay đổi chưa commit hoặc lệnh báo lỗi, dừng để kiểm tra, không reset/xóa thay đổi. Không chuyển nhánh đồng thời khi nhiều người đang dùng chung một thư mục làm việc.

## 3. Phát — frontend giao diện

**Mục tiêu:** người dùng thao tác được luồng Collection → Next → Pre-processing → preview → Apply → lưu/thoát/mở phiên bằng dữ liệu và trạng thái thật.

**Vị trí làm:** `apps/web/src/features/collection`, `apps/web/src/features/preprocessing`, `apps/web/src/features/session`, `apps/web/src/components`. Phát điều phối thay đổi `apps/web/src/app/App.tsx` và `styles.css` với Nga, tránh cùng sửa một khối mã.

**Cách thực hiện:**

1. Tách UI hiện có thành component nhỏ; bổ sung chọn CSV và cấu hình import theo contracts, chưa tự viết parser trong component.
2. Nhận dữ liệu/progress/error từ Worker do Nguyên cung cấp; hiển thị Collection và bảng dữ liệu, rồi cho Next khi dữ liệu hợp lệ.
3. Thống nhất với Nga cách truyền dataset, chart state và selection gồm `rowId`, `columnId`, `versionId`; bảng và 3D chọn cùng một ô.
4. Tạo form cấu hình Missing và preview; gọi engine qua Worker. Nút Apply chỉ dùng preview còn hiệu lực và gọi API storage của Trâm.
5. Hiển thị riêng đang xử lý, lỗi, đã lưu trên máy và trạng thái sync; không báo lưu thành công chỉ vì Worker chạy xong.
6. Nối UI tài khoản với Phúc và project/sync với Tuấn khi các API thật sẵn sàng. Phần chưa có phải ghi rõ, không đăng nhập giả.

**Hoàn thành khi:** luồng dùng dữ liệu thật; lỗi hiển thị có thể xử lý; Apply/Thoát chờ lưu thành công; không mất lựa chọn do dùng index thay stable ID. Việc đầu tiên: giao diện Collection nhận một dataset đúng contracts và hiển thị lỗi import.

## 4. Nga — frontend 3D và kiểm thử tương tác

**Mục tiêu:** quan sát Missing bằng 3D, chọn đúng ô và xem preview mà không sửa nhầm phiên bản.

**Vị trí làm:** `apps/web/src/scene`, component riêng cho 3D trong thư mục này, các ca tương tác tại `tests/e2e`. Thống nhất trước với Phát nếu cần sửa App hoặc CSS chung.

**Cách thực hiện:**

1. Dựng scene R3F/Three nhỏ với camera, zoom và điều khiển cơ bản bằng thư viện đã có.
2. Nhận dataset/chart result từ giao diện đã thống nhất, ánh xạ đối tượng hiển thị về stable IDs. Không tự parse CSV hoặc tính thống kê trong render.
3. Chọn điểm/ô trả selection cho Phát; hiển thị popup và cập nhật bảng theo cùng selection.
4. Phân biệt chart phiên bản cũ: chỉ đọc, không dùng để sửa current dataset. Chỉ chạy lại chart khi người dùng yêu cầu.
5. Hiển thị so sánh preview; phối hợp Trâm/Phát lưu và khôi phục camera/config. Nếu lấy mẫu để hiển thị, phải có nhãn; thống kê vẫn tính toàn bộ.
6. Viết hoặc bổ sung E2E chọn điểm, đồng bộ selection, mở lại camera và chặn chỉnh sửa chart cũ.

**Hoàn thành khi:** chọn đúng dữ liệu, tương tác không gây page error, chart giữ đúng version nguồn và không tự tính lại sau Apply. Việc đầu tiên: một scene tối thiểu nhận dataset đúng contracts và trả selection đúng.

## 5. Phúc — backend tài khoản và quyền truy cập

**Mục tiêu:** đăng ký, đăng nhập và bảo vệ API bằng tài khoản thật.

**Vị trí làm:** `apps/api/src/modules/auth`, `apps/api/src/modules/users`; phối hợp Trâm về config/database và Tuấn về kiểm tra ownership. Thống nhất khi sửa `apps/api/src/app.ts`, không tạo Fastify app thứ hai.

**Cách thực hiện:**

1. Chốt schema tài khoản, cấu hình username/password/session còn mở trong quyết định kiến trúc; đưa request/response dùng chung vào contracts sau khi thống nhất.
2. Phối hợp Trâm tạo unique index cho username đã chuẩn hóa; xử lý cả hai yêu cầu đăng ký trùng đồng thời.
3. Dùng thuật toán băm mật khẩu chuẩn phù hợp Node; không lưu/log mật khẩu thô hoặc trả password hash.
4. Làm đăng ký chỉ với username/password; thành công chuyển về đăng nhập. Đăng nhập đúng mới tạo phiên thật.
5. Thực hiện cookie/session, CSRF/Origin/CORS và giới hạn thử đăng nhập theo đặc tả đã chốt. Cung cấp giao diện kiểm tra user/session cho Tuấn.
6. Kiểm tra sai mật khẩu, chưa đăng nhập, hết phiên, dữ liệu hai tài khoản và logout phối hợp sync/local. Không xóa local khi sync lỗi.

**Hoàn thành khi:** kiểm thử auth/ownership đạt và có kiểm chứng tích hợp MongoDB thật; nếu chỉ dùng test double phải ghi rõ chưa xác minh Atlas. Việc đầu tiên: thống nhất auth contract và ma trận lỗi với Phát, Tuấn, Trâm.

## 6. Tuấn — backend project, dữ liệu và sync

**Mục tiêu:** API lưu/đọc tài nguyên có kiểm tra quyền, công bố dữ liệu hoàn chỉnh và đồng bộ không tạo bản sao hoặc ghi đè âm thầm.

**Vị trí làm:** các module nghiệp vụ dưới `apps/api/src/modules/`: `projects`, `datasets`, `versions`, `sessions`, `charts`, `sync`. Chỉ tạo module khi triển khai chức năng đó. Phía client điều phối sync nằm tại `apps/web/src/sync`, phối hợp Phát và Trâm.

**Cách thực hiện:**

1. Chốt với Trâm schema lưu và với Phát request/response cho tạo/mở project. Bám quan hệ một project–một nguồn–một phiên theo prompt.
2. Làm một lát nhỏ: tạo project → lưu MongoDB → đọc lại → frontend hiển thị; gọi giao diện auth của Phúc để kiểm tra ownership.
3. Triển khai lưu chunk và publication cho dataset/version; không nhét toàn bộ dataset vào một document hoặc báo hoàn tất khi mới nhận một phần.
4. Xây upload/resume và operation ID ổn định cho retry; chỉ ACK đã đồng bộ sau khi nội dung/metadata công bố đầy đủ.
5. Giữ riêng kết quả local khi base revision xung đột; không ghi đè con trỏ server âm thầm. Lỗi phải giữ outbox để thử lại.
6. Phối hợp Trâm/Phát nối client outbox với API; kiểm tra gửi lặp, mất ACK, hết auth và Atlas lỗi.

**Hoàn thành khi:** API thật kiểm tra ownership, retry không tạo bản sao, publication chưa đủ không hiện là đã đồng bộ, xung đột không mất dữ liệu. Việc đầu tiên: project API nhỏ theo hợp đồng chung, không viết toàn bộ sync ngay từ đầu.

## 7. Trâm — database MongoDB và storage IndexedDB

**Mục tiêu:** dữ liệu lưu đúng, mở lại được và không mất bản hoàn chỉnh khi ghi lỗi. MongoDB là phía server; IndexedDB là phía browser, hai nơi không tự đồng bộ.

**Vị trí làm:** kết nối/config tại `apps/api/src/plugins`, `apps/api/src/config`; storage local tại `apps/web/src/storage`; thiết kế tại `docs/architecture/database-storage.md` khi bắt đầu thực hiện. Repository truy cập collection thuộc module nghiệp vụ tương ứng của Phúc/Tuấn; Trâm phối hợp thay đổi, không tạo lớp truy cập song song trái ownership.

**Cách thực hiện:**

1. Vẽ schema cho account/project/dataset/version/session/chart và quan hệ ID; phân biệt metadata và nội dung chunk, thống nhất với Phúc/Tuấn.
2. Chốt index, username unique, operation ID unique theo account và cách truy vấn có ownership. Thiết kế chunk hoặc GridFS phù hợp giới hạn document MongoDB.
3. Làm kết nối backend với env validation; `.env.example` chỉ placeholder. Không đưa URI/credential vào frontend, PR, log hoặc tài liệu.
4. Ưu tiên IndexedDB publication/recovery cho luồng local: staging chunk → kiểm tra tồn tại/kích thước/hash → công bố version/history/current/outbox nhất quán.
5. Cung cấp hàm lưu/đọc/apply/session rõ ràng cho Phát và Nguyên; chỉ resolve thành công khi ghi hoàn tất. Thất bại giữ current version cũ.
6. Kiểm tra quota/lỗi ghi/reload/manifest thiếu chunk và khôi phục. Phối hợp Tuấn giữ outbox và xử lý ACK, không xóa dữ liệu chưa sync.

**Hoàn thành khi:** lưu/đọc thật được kiểm chứng, lỗi ghi không công bố bản dở dang, frontend không chứa secret, index quan trọng được kiểm tra. Việc đầu tiên: cùng Tuấn chốt schema tối thiểu; cùng Phát thử ghi/đọc một dataset local. Đây là phần rộng, Phúc/Tuấn phải cùng triển khai adapter MongoDB trong module mình, không dồn toàn bộ code database cho Trâm.

## 8. Nguyên — CSV, thống kê, Missing và Worker

**Mục tiêu:** tính đúng, UI không bị chặn bởi xử lý nặng, preview không tự thay đổi dữ liệu chính.

**Vị trí làm:** `packages/data-engine/src`, tests của package; Worker và cầu nối tại `apps/web/src/workers`; sử dụng fixture kỳ vọng trong `tests/fixtures/rules.ts`.

**Cách thực hiện:**

1. Giữ engine là hàm TypeScript thuần, không React/DOM/MongoDB; dùng contracts có sẵn, không tạo Dataset riêng khác cấu trúc.
2. Viết CSV parser/pipeline theo baseline: UTF-8, delimiter/header, missing opt-in, bảo toàn mã 001/số ngoài độ chính xác, lỗi số cột và giới hạn 20.000.000 byte.
3. Dùng Worker có job ID, progress/cancel/error/result được validate; chia công việc và kiểm soát truyền dữ liệu lớn. Không xử lý nặng trong component React.
4. Làm thống kê theo quy tắc đã chốt, dùng toàn bộ dữ liệu và trả N/A kèm lý do khi không tính được.
5. Làm Missing một ô và hàng loạt theo baseline; mode tie, nội suy đầu/cuối, all-missing phải đúng. Preview gắn baseVersion/config, không commit hoặc tự thêm outbox.
6. Trả kết quả đúng hợp đồng cho Phát/Nga; phối hợp Trâm để Apply kiểm tra preview còn hiệu lực trước publication.

**Hoàn thành khi:** thuật toán đối chiếu fixture đạt, hủy/lỗi không đổi current dataset, kết quả không có NaN/Infinity và UI nhận trạng thái thật. Việc đầu tiên: CSV nhỏ qua Worker và một hàm Missing có test expected rõ ràng.

## 9. Hợp đồng để ghép các phần

| Kết nối             | Hai bên cần chốt                                              | Nơi ghi nhận                                                       |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| UI ↔ API            | Endpoint/method, request/response, mã lỗi, auth và ownership  | `packages/contracts` và tài liệu API trong `docs`                  |
| UI ↔ Worker         | job ID, input/output, progress, cancel, error, version/config | `packages/contracts`, `apps/web/src/workers`                       |
| UI ↔ 3D             | Dataset/chart version, stable selection, camera/config        | Kiểu dùng chung phía web; contracts nếu đi qua biên lưu/Worker/API |
| UI/engine ↔ storage | Hàm lưu/đọc/apply, thời điểm thành công, lỗi/quota, recovery  | Giao diện công khai tại `apps/web/src/storage`                     |
| API ↔ MongoDB       | Collection/schema, index, chunk, transaction/publication      | `docs/architecture/database-storage.md` và module sở hữu           |
| Local ↔ server      | Outbox, operation ID, dependency, ACK, retry/conflict         | Contracts và giao thức sync do Tuấn/Trâm thống nhất                |

Không tự đổi tên trường chung. Nếu phải đổi contracts, các bên sử dụng cần sửa trong cùng đợt tích hợp. Fixture phát triển phải có nhãn, không được dùng để báo API/Atlas/lưu dữ liệu thật đã hoàn thành.

## 10. Thứ tự phối hợp trong 6 ca tối

Mọi người rảnh từ 20:00; tạm dùng ca 20:00–22:00, giờ kết thúc và ngày giờ bàn giao còn cần xác nhận. Cơ cấu mới mở rộng sang auth/sync/database; không thể xem việc chia người là cam kết làm đủ tất cả trong 6 ca.

| Ca  | Đầu ra chung cần hướng tới                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Chạy được dự án; tạo nhánh; chốt contracts, schema và một CSV expected; mỗi người hoàn thành một thử nghiệm nhỏ ở phần mình.  |
| 2   | Ghép CSV → Worker → Collection và lưu/đọc local; song song ghép auth/project API với database khi đủ điều kiện.               |
| 3   | Ghép chọn ô 3D → preview; kiểm tra API chưa đăng nhập/ownership; điều chỉnh kế hoạch theo kết quả thật.                       |
| 4   | Ghép Apply → lưu → mở lại; auth/project thật nối UI; chỉ mở rộng sync khi publication và ownership ổn. Ghi rõ phần còn thiếu. |
| 5   | Kiểm thử production, xử lý lỗi dữ liệu/tích hợp; kiểm chứng sync nếu đã triển khai, không báo đạt bằng mock.                  |
| 6   | Hồi quy, tập demo, hướng dẫn chạy và báo cáo phần đã đạt/chưa đạt. Không mở thêm tính năng.                                   |

Đây là mục tiêu phối hợp để cập nhật mỗi ca, không thay thế ước lượng chi tiết. Offline/PWA, đầy đủ các phương pháp ngoài Missing và nghiệm thu toàn bộ vẫn là yêu cầu còn lại, chưa mặc định được bỏ hoặc hoàn thành trong bảng này.

Mỗi ca dành 10 phút đầu cập nhật, một checkpoint giữa ca và 15–20 phút cuối chạy bản chung. Việc nhỏ nên có đầu ra trong 30–60 phút. Vướng 15–20 phút thì báo kèm lỗi và cách tái hiện, không chờ đến cuối ngày.

## 11. Cách đưa mã vào bản chung và nghiệm thu

1. Chỉ stage những file thuộc thay đổi của mình, kiểm tra `git diff` trước khi commit; tránh `git add .` khi có file không rõ nguồn hoặc secret.
2. Push nhánh cá nhân và mở PR vào nhánh tích hợp đã chốt. Ghi hành vi mới, cách chạy kiểm tra, ảnh UI nếu cần và phần chưa xác minh.
3. Người ở phía kết nối review: Phát–Nga, Phúc–Tuấn, Trâm–Tuấn/Phúc, Nguyên–Phát/Trâm. Review chéo không thay thế kiểm thử kỹ thuật.
4. Merge từng phần nhỏ chạy được. Sau merge, các nhánh cập nhật bản tích hợp; xử lý conflict cùng chủ sở hữu file, không ghi đè để mất mã.
5. Chạy `npm run check` cho thay đổi mã và `npm run test:e2e` khi thay đổi luồng giao diện/lưu/mở. Test domain/storage/API bổ sung theo rủi ro tính năng, không chỉ kiểm tra UI có hiện.
6. Bàn giao mã đã merge, kết quả expected/actual, lệnh tái hiện và giới hạn. Không đánh dấu hoàn thành khi chỉ chạy riêng trên nhánh hoặc dùng dữ liệu giả.

Không bỏ kiểm tra kiểu, tắt lint hay ép kiểu để lách validation. Không sửa hai prompt gốc để hợp thức hóa việc thiếu tính năng. Dữ liệu đã lưu local không đồng nghĩa đã sync; health HTTP 200 không đồng nghĩa Atlas sẵn sàng; reload thành công không chứng minh PWA offline.
