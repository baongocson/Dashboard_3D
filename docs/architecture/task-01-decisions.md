# Nhiệm vụ 01 — Quy tắc và hợp đồng triển khai

Ngày: 2026-11-05. Phạm vi giao tiếp theo: hoàn thành nhiệm vụ 01 rồi nền tảng nhiệm vụ 02; chưa thực hiện storage, nhập CSV, thuật toán, tài khoản hoặc Atlas.

## Nguồn và trạng thái quyết định

- [Prompt chức năng](../prompt/prompt_tong_quan_chuc_nang_va_tuong_tac_3d.md) sở hữu hành vi sản phẩm.
- [Prompt công nghệ](../prompt/prompt_cong_nghe_dashboard_3d.md) sở hữu kỹ thuật, tài khoản, offline, sync.
- [Đề xuất người dùng gửi](../requirements/proposed-rules-source.md) được lưu nguyên văn, SHA-256 `04E84326FED54ED2564129A6C9F17A5E6DD22F9637E77E1F695F97A345181736`.

**Đã chốt từ hai prompt:** stack, CSV 20.000.000 byte, một project–một nguồn–một phiên, Worker, local commit nhất quán, preview chưa commit, không tự chạy lại biểu đồ, offline tương tác, tài khoản thật, quyền sở hữu, bảo toàn xung đột, không xuất tệp/AI/SMTP/OTP.

**Baseline triển khai của lần giao mới:** áp dụng các quy tắc cụ thể ở mục CSV, thống kê, Missing, Transformation/Encoding và lưu phiên dưới đây theo nội dung người dùng giao để hoàn thành nhiệm vụ 01. Đây là ghi nhận phạm vi mới, không sửa ngược hai prompt hoặc coi toàn bộ ví dụ/đề xuất là yêu cầu đã chốt từ trước.

**Đề xuất chưa nghiệm thu/chưa triển khai:** cấu hình username/mật khẩu/thời hạn phiên, lựa chọn thư viện ngoài stack bắt buộc, giao thức upload/resume, lưu nội dung Atlas, ngưỡng tài nguyên, tham số bộ tối ưu MLE. Hai thời hạn phiên trong nguồn vẫn là đề xuất cấu hình.

**Mục tiêu cần đo:** báo đang chạy khoảng 0,5 giây, phản hồi hủy khoảng 1 giây với công việc chia nhỏ được. Không có kết quả đo hiệu năng, offline hoặc Atlas trong nhiệm vụ 01.

## Đối chiếu và cách giải thích

| Mục nguồn mới             | Đối chiếu hai prompt                | Quyết định                                                                                                                                                                             |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Local trước tài khoản  | Chức năng §12; công nghệ §7, §9     | Mốc phát triển nội bộ có nhãn, không tạo chế độ khách hoặc đăng nhập giả. Luồng vẫn có **Next** giữa Collection và Pre-processing. Chạy lại luồng với tài khoản thật ở nhiệm vụ 16–18. |
| 2. CSV                    | Chức năng §1, §3, §13; công nghệ §6 | Làm rõ những quy tắc chưa chốt; không thêm định dạng nhập.                                                                                                                             |
| 3. Thống kê               | Chức năng §3, §7–8, §13             | Dùng chung hàm và hiển thị cấu hình; N/A không phải 0.                                                                                                                                 |
| 4. Missing                | Chức năng §6                        | Chốt tie/order/interpolation, giữ phạm vi một ô và không bịa dữ liệu.                                                                                                                  |
| 5. Biến đổi/encoding/ngày | Chức năng §5, §9–10                 | Không tự chuẩn hóa sau Yeo–Johnson; giữ đủ mapping và dữ liệu undo.                                                                                                                    |
| 6. Lưu phiên              | Chức năng §11–12; công nghệ §7, §9  | Lưu góc nhìn và chọn ô bằng stable ID; không tính lại biểu đồ lúc mở.                                                                                                                  |
| 7. Tài khoản              | Công nghệ §9                        | Bổ sung cấu hình đề xuất. Đăng ký hoạt động ngay nhưng **chuyển về đăng nhập**, không tự đăng nhập. Giữ đầy đủ chính sách đăng xuất từ prompt.                                         |
| 8. Sync                   | Công nghệ §7–8                      | “Lưu local rồi thêm hàng đợi” là thứ tự logic; dữ liệu/metadata/outbox phải cùng ranh giới công bố, không phải hai commit rời.                                                         |
| 9. Hiệu năng              | Công nghệ §7, §10                   | Máy MSI Thin 15 RAM 16 GB; Chrome chính, Edge đối chiếu. Chưa chốt số điểm hoặc giới hạn dòng/cột.                                                                                     |

Không có mâu thuẫn trực tiếp cần dừng công việc. Các diễn giải trên bảo toàn ràng buộc mạnh hơn đã có, không dùng nguyên tắc tệp đọc sau thắng.

## CSV — baseline

- UTF-8 có/không BOM; decode lỗi phải báo. Tự phát hiện `,`, `;`, tab, cho xem trước/đổi delimiter.
- Mặc định dòng đầu là header; có lựa chọn không header, tên `column_1`, `column_2`… Header rỗng/trùng: đề xuất tên, chờ người dùng xác nhận trước khi hoàn tất.
- Bỏ bản ghi hoàn toàn trống; giữ bản ghi có trường nhưng mọi ô thiếu. Dòng sai số cột chặn hoàn tất; báo vị trí bản ghi và vị trí dòng nguồn (CSV có thể có newline trong chuỗi quoted).
- Missing mặc định: rỗng hoặc toàn whitespace; `0` không missing. `NA`, `null`, `-` chỉ thiếu khi người dùng chọn. Danh sách token lưu cùng cấu hình import; không biến chuỗi hợp lệ thành null ngầm.
- Chuyển cột số chỉ khi mọi giá trị không thiếu phù hợp. Cột lẫn kiểu, mã có số 0 đầu, số nguyên ngoài độ chính xác an toàn giữ text. Ngày tháng giữ text lúc nhập.
- Không tự suy diễn `1,234`; cần quy tắc số rõ ràng. Số không hữu hạn hoặc chuyển đổi mất chính xác không được công bố thành Number.
- Kiểm tra dung lượng trước parse: tối đa 20.000.000 byte, không phải 20 MiB; không áp giới hạn này lên đầu ra one-hot.

## Thống kê — baseline

- Pearson, loại missing theo từng cặp; hiển thị số cặp hợp lệ. Ít hơn hai cặp hoặc cột hằng: N/A và lý do. Trường hợp quá ít quan sát phải cảnh báo; ngưỡng cảnh báo bổ sung còn đề xuất.
- Collection dùng IQR k=1.5. Phân vị: `h=(n-1)*p`, nội suy tuyến tính hai vị trí lân cận. Duplicate giữ quy tắc đề xuất từ prompt: trùng toàn bộ cột, đếm dòng dư, giữ dòng đầu.
- Độ lệch chuẩn mẫu số n dùng thống nhất Standard và Z-score. Thiếu dữ liệu, IQR=0 hoặc sigma=0 cần kết quả có trạng thái/lý do thay vì NaN/Infinity; chính sách đánh dấu ngoại lệ IQR=0 sẽ đặc tả trước nhiệm vụ 13.
- Bỏ missing khi tính, hiển thị số hợp lệ. Tất cả thống kê tính toàn bộ dữ liệu, không dùng mẫu hiển thị.

## Missing — baseline

- Mode đồng hạng: lấy giá trị xuất hiện đầu theo thứ tự dòng hiện tại; hiển thị cảnh báo đồng hạng.
- Nội suy tuyến tính chỉ giữa hai điểm đã biết. Không ngoại suy ở đầu/cuối. Forward/back fill thiếu láng giềng thích hợp thì giữ null.
- Cột toàn thiếu: chỉ cố định, xóa dòng/cột hoặc bỏ qua; fixed value phải hợp kiểu hoặc yêu cầu chọn kiểu rõ ràng nếu schema chưa xác định.
- Thứ tự mặc định theo dòng; sort tăng/giảm ổn định với giá trị bằng nhau. Trục số/thời gian phải hợp lệ, không thiếu/trùng; nếu sai yêu cầu sửa hoặc người dùng chọn nội suy theo thứ tự dòng.
- Sort chỉ để tính mặc định trả về thứ tự đầu ra trước thao tác. Chỉ thay thứ tự đầu ra khi người dùng chủ động chọn. Mỗi cột có phương pháp riêng, cột bỏ qua giữ nguyên.
- Fill một ô chỉ đổi ô chọn. Mean/median/mode lấy tập hợp hợp lệ của cột theo phạm vi; xóa dòng/cột phải thông báo phạm vi lớn hơn ô.

## Transformation, ngày, Encoding — baseline

- Yeo–Johnson ước lượng lambda theo MLE riêng từng cột, lưu lambda/phương pháp; thất bại báo theo cột, không tự thay lambda hoặc chuẩn hóa tiếp. Còn cần chốt dung sai, khoảng tìm kiếm, thuật toán và xử lý cột hằng trước nhiệm vụ 14.
- Log1p yêu cầu x>-1, sqrt yêu cầu x>=0. Giữ missing. Giá trị ngoài miền chặn áp dụng đến khi người dùng đổi phạm vi/phương pháp; không cộng hằng số.
- Ngày: chuỗi lịch hợp lệ YYYY-MM-DD. Datetime có timezone chuyển ISO UTC; chưa có timezone phải yêu cầu chọn. Không đoán ngày nhập nhằng. Cần đặc tả DST thiếu/trùng trước chuyển đổi ngày ở nhiệm vụ 12.
- One-hot: `tenCot__nhom`, hậu tố tránh trùng; preview toàn bộ tên và mapping. Mặc định thay nguồn, có lựa chọn giữ. Undo phục hồi nguồn từ phiên bản trước.
- Missing trong Encoding: mặc định yêu cầu xử lý trước; chỉ tạo nhóm missing khi người dùng chủ động chọn, không va chạm với nhóm text thật có tên giống nhãn missing.
- Ordinal theo thứ tự người dùng xác định. Nhiều nhóm phải báo số cột và đánh giá khả năng lưu, không gộp ngầm.

## Lưu phiên, commit và ranh giới phiên bản

Lưu: raw; current version; versions được history/chart tham chiếu; lịch sử/undo; mục mở; cột/phương pháp/tham số xác nhận; chart configuration + result + version nguồn; camera/zoom; table filters/sorts/selection stable ID; trạng thái sync và outbox.

Không bắt buộc khôi phục hover, job đang chạy hoặc preview chưa áp dụng. Mở phiên không tính lại chart. Nếu selection/chart thuộc phiên bản cũ thì chỉ xem, không sửa nhầm current version.

Preview gắn `baseVersionId` và `configFingerprint`; thay dữ liệu/cấu hình phải preview lại. Worker hoàn tất không đồng nghĩa Áp dụng thành công.

Ghi chunk staging → xác minh nội dung/manifest → transaction công bố version + history + current pointer + outbox → báo đã lưu. Thất bại không đổi bản hiện tại; giữ preview trong bộ nhớ khi có thể để thử lại. Không yêu cầu transaction chứa toàn bộ dataset lớn. Manifest/schema hợp lệ **không phải bằng chứng byte đã ghi bền vững**; storage phải kiểm tra sự tồn tại, kích thước và hash nội dung ở nhiệm vụ 03.

Thoát chờ lưu thành công, lỗi không thoát. Đóng tab đột ngột chỉ khôi phục commit hoàn chỉnh gần nhất; không dựa unload. Không có xuất cứu hộ. Hoàn tác lưu con trỏ/lịch sử/outbox nhất quán và không xóa raw/chart references.

## Tài khoản và sync — đặc tả đề xuất cho giai đoạn sau

- Username ASCII Latin `A-Z a-z 0-9 _ - .`, 3–30 sau trim, so khớp không phân biệt hoa thường. Unique index chống hai đăng ký đồng thời.
- Password 15–128 ký tự, cho whitespace/Unicode, không trim/case fold/normalize. Đề xuất đếm Unicode code points; chốt đơn vị trước nhiệm vụ 16.
- Idle 24h, absolute 7 ngày; “hoạt động hợp lệ” cần định nghĩa để request nền sync không vô tình gia hạn mãi. Không dùng đồng hồ client quyết định phiên server.
- Cookie HttpOnly, SameSite=Lax, Secure khi HTTPS; Origin + CSRF token cho mutation, CORS allowlist. Đây là đề xuất, chưa có auth endpoint trong nền tảng.
- Offline hết auth: tiếp tục workspace đã mở khóa nhưng phải đăng nhập lại trước API/sync. Local không phải quyền truy cập API. Không trộn account. Đăng ký thành công chuyển đăng nhập, không OTP/email.
- Logout: offline có pending thì chặn; không pending thì xóa local account và giữ bản ghi thu hồi tối thiểu chờ gửi; online cho sync trước hoặc xác nhận xóa cả dữ liệu chưa sync. Sync lỗi không tự xóa. Không áp các quy tắc này vào Thoát phiên.
- Sync theo phụ thuộc từng project; parent công bố trước child; lỗi một project không chặn vô hạn project khác. Operation ID ổn định, unique theo account; retry/mất ACK trả kết quả cũ.
- Đề xuất upload ID + danh sách chunk còn thiếu; hết hạn upload lại từ local cùng operation ID. Không cho endpoint bất kỳ đánh dấu đã đồng bộ trước server publication.
- Sai baseRevision: giữ riêng dữ liệu local và quan hệ cha, không ghi đè con trỏ server. Metadata conflict giữ pending và thông báo; cách giải quyết chi tiết còn cần chốt ở nhiệm vụ 18, chưa xây UI nhánh.
- Phân biệt Internet/backend/Atlas readiness. Chỉ ACK công bố đầy đủ mới là đã đồng bộ. Không sync preview hoặc hứa sync khi tab đóng.

## Hợp đồng bàn giao và giới hạn xác minh

`packages/contracts/src/index.ts`: schema version 1, Cell, Column, Row, Dataset, import options, single-cell preview, manifest, version, history, outbox, apply publication, project, session, chart và foundation Worker messages. Ràng buộc version/row/column ID là nền cho các thao tác sau; chưa có job xử lý giả.

`tests/fixtures/rules.ts`: catalog input/expected cho CSV, thống kê, Missing, biến đổi/encoding, phiên và sync. Đây là fixture kỳ vọng, không phải kết quả thuật toán đã chạy. Schema tests chỉ xác minh hợp đồng có sẵn. Domain tests sẽ dùng catalog khi nhiệm vụ sở hữu thuật toán được triển khai.

Nhiệm vụ 01 đạt khi: đối chiếu đủ 9 nhóm nguồn; định nghĩa commit rõ; phân biệt baseline/đề xuất/mục tiêu; hợp đồng kiểm tra runtime có tests âm/dương; fixture gắn nhiệm vụ triển khai. Không báo nghiệm thu luồng đầu cuối hoặc hiệu năng chỉ từ việc tests hợp đồng chạy đạt.

Mốc sau nền tảng: 03 storage → 04 CSV Worker → 05 Collection/Next → 06 Missing 3D → 07 preview → 08 apply/autosave → 09 lưu/thoát/mở → 10 undo và E2E local. Sau đó 11–15 phương pháp còn lại; 16 account → 17 Atlas → 18 sync → 19 offline/logout → 20 nghiệm thu toàn bộ.
