# Đề xuất chốt các quy tắc triển khai Dashboard 3D

Các nội dung dưới đây là đề xuất để thống nhất trước khi triển khai. Các chỉ tiêu hiệu năng là mục tiêu cần đo, chưa phải kết quả đã được kiểm chứng.

## 1. Làm luồng local trước tài khoản

- Dùng workspace và dữ liệu kiểm thử nội bộ có nhãn rõ ràng.
- Không đưa đăng nhập giả hoặc chế độ khách vào giao diện sản phẩm.
- Hoàn thành luồng:
  Nhập CSV → Collection → Missing 3D → chọn ô → xem trước →
  Áp dụng → tự lưu → thoát và mở lại phiên.
- Khi có tài khoản và Atlas thật, chạy lại luồng để kiểm tra quyền sở hữu và cách ly dữ liệu.
- Mốc kiểm chứng local chưa được coi là nghiệm thu sản phẩm đầy đủ.

## 2. Quy tắc đọc CSV

| Nội dung | Quy tắc đề xuất |
|---|---|
| Encoding | UTF-8, có hoặc không có BOM; lỗi encoding phải được thông báo |
| Delimiter | Tự phát hiện dấu phẩy, chấm phẩy hoặc tab; cho xem trước và thay đổi |
| Header | Mặc định dòng đầu là tiêu đề; có lựa chọn tệp không có tiêu đề |
| Không có header | Tạo tên `column_1`, `column_2`… |
| Header rỗng hoặc trùng | Đề xuất tên thay thế và yêu cầu xác nhận |
| Dòng trống | Bỏ dòng hoàn toàn trống; giữ dòng có các trường nhưng mọi ô đều thiếu |
| Dòng sai số cột | Báo vị trí lỗi và chặn hoàn tất nhập; không âm thầm bỏ dòng |
| Missing mặc định | Ô rỗng hoặc chỉ chứa khoảng trắng |
| Ký hiệu missing bổ sung | `NA`, `null`, `-`… chỉ được coi là thiếu khi người dùng chọn |
| Suy luận kiểu số | Chỉ chuyển khi toàn bộ giá trị không thiếu của cột phù hợp |
| Cột lẫn kiểu | Giữ văn bản, cho chuyển kiểu trong Cleaning |
| Mã có số 0 đầu | Giữ văn bản để bảo toàn giá trị |
| Số nguyên vượt độ chính xác | Giữ văn bản, không tự chuyển sang Number |
| Ngày tháng | Giữ văn bản khi nhập; chuyển đổi theo định dạng được chọn trong Cleaning |
| Dung lượng tối đa | 20.000.000 byte mỗi CSV |

Không tự diễn giải `1,234` là số thập phân hoặc phân cách hàng nghìn khi chưa xác định quy tắc.

## 3. Quy tắc thống kê

| Nội dung | Quy tắc đề xuất |
|---|---|
| Tương quan | Pearson giữa các cột số phù hợp |
| Cặp có missing | Chỉ dùng dòng có đủ hai giá trị của cặp cột đang tính |
| Thông tin kèm tương quan | Hiển thị số cặp giá trị hợp lệ |
| Không tính được | Hiển thị `N/A` và lý do, không thay bằng 0 |
| Outlier tại Collection | IQR với hệ số mặc định 1.5 |
| Phân vị | Nội suy tuyến tính trên dãy đã sắp xếp, vị trí `h = (n - 1) × p` |
| Độ lệch chuẩn | Dùng mẫu số `n`, thống nhất cho Standard Scaling và Z-score |
| Missing | Bỏ qua khi tính, đồng thời hiển thị số giá trị hợp lệ |

- Collection và Pre-processing dùng chung hàm tính thống kê.
- Cột hằng hoặc không đủ dữ liệu phải có thông báo rõ.
- Không tạo NaN/Infinity để đưa vào dữ liệu kết quả.
- Nếu số quan sát quá ít, cảnh báo hạn chế của kết quả.

## 4. Quy tắc xử lý missing

| Tình huống | Quy tắc đề xuất |
|---|---|
| Mode đồng hạng | Chọn giá trị xuất hiện đầu tiên theo thứ tự dòng hiện tại; thông báo có đồng hạng |
| Nội suy | Chỉ nội suy tuyến tính giữa hai điểm đã biết |
| Thiếu ở đầu/cuối | Giữ missing, không tự ngoại suy |
| Điền tiến | Không có giá trị trước đó thì giữ missing |
| Điền lùi | Không có giá trị phía sau thì giữ missing |
| Cột thiếu hoàn toàn | Chỉ cho điền cố định, xóa dòng/cột hoặc bỏ qua |
| Thứ tự mặc định | Theo thứ tự dòng |
| Chọn cột sắp xếp | Cho chọn chiều tăng/giảm; các giá trị bằng nhau giữ thứ tự cũ |
| Nội suy theo số/thời gian | Trục phải hợp lệ, không thiếu và không trùng |
| Trục nội suy không hợp lệ | Yêu cầu xử lý hoặc chuyển sang nội suy theo thứ tự dòng |

- Dùng định danh dòng ổn định.
- Nếu sắp xếp chỉ để tính, mặc định trả kết quả về thứ tự dòng ban đầu.
- Mỗi cột có thể sử dụng phương pháp khác nhau.
- Xử lý riêng ô chỉ thay đổi ô đã chọn; xóa dòng/cột phải thông báo đúng phạm vi.

## 5. Transformation và Encoding

### 5.1. Transformation

| Nội dung | Quy tắc đề xuất |
|---|---|
| Yeo–Johnson | Ước lượng lambda riêng từng cột bằng MLE |
| Tham số | Lưu lambda và thông tin phương pháp cùng phiên bản kết quả |
| Chuẩn hóa sau Yeo–Johnson | Không tự thực hiện; người dùng chọn riêng trong mục Chuẩn hóa |
| Ước lượng thất bại | Báo lỗi theo cột; không âm thầm thay lambda |
| Log1p | Chỉ áp dụng khi `x > -1` |
| Căn bậc hai | Chỉ áp dụng khi `x >= 0` |
| Missing | Giữ missing, không đổi thành 0 |
| Miền dữ liệu không hợp lệ | Báo trước khi áp dụng; không tự cộng hằng số |

### 5.2. Ngày tháng

- Ngày thuần: lưu dạng `YYYY-MM-DD`.
- Thời điểm có múi giờ: chuẩn hóa về UTC.
- Thời điểm chưa có múi giờ: yêu cầu người dùng xác định trước khi chuyển sang UTC.
- Không tự đoán định dạng ngày tháng nhập nhằng.

### 5.3. Encoding

| Nội dung | Quy tắc đề xuất |
|---|---|
| One-hot | Tên dạng `tenCot__nhom`, bổ sung hậu tố nếu trùng |
| Ánh xạ | Lưu liên kết giữa tên cột đầu ra và giá trị nhóm gốc |
| Cột nguồn | Cho chọn giữ hoặc thay; mặc định thay trong phiên bản kết quả |
| Hoàn tác | Phiên bản trước giữ đủ dữ liệu để khôi phục cột nguồn |
| Missing | Mặc định yêu cầu xử lý trước; có lựa chọn chủ động coi missing là nhóm riêng |
| Ordinal | Người dùng xác định thứ tự nhóm |
| Nhiều nhóm | Hiển thị số cột đầu ra dự kiến; không tự gộp nhóm |

## 6. Nội dung lưu trong phiên làm việc

### Bắt buộc lưu

- Dữ liệu nguồn.
- Phiên bản hiện tại.
- Các phiên bản còn được lịch sử hoặc biểu đồ tham chiếu.
- Lịch sử thao tác và thông tin phục vụ hoàn tác.
- Mục đang mở.
- Cột, phương pháp và tham số đã xác nhận.
- Cấu hình và kết quả biểu đồ, phiên bản dữ liệu nguồn.
- Góc nhìn và mức phóng biểu đồ.
- Bộ lọc, sắp xếp bảng và ô đang chọn bằng định danh ổn định.
- Trạng thái đồng bộ và hàng đợi thay đổi.

### Không bắt buộc lưu

- Bảng thông tin đang hiện do rê chuột.
- Tác vụ đang chạy.
- Bản xem trước chưa áp dụng.

### Quy tắc lưu

- Tự lưu sau mỗi lần Áp dụng thành công.
- Chỉ báo thành công sau khi dữ liệu local được công bố nhất quán.
- Thoát phiên phải chờ lưu thành công.
- Lưu lỗi thì giữ trạng thái, cho thử lại, không tự thoát.
- Đóng tab đột ngột chỉ bảo đảm khôi phục lần lưu hoàn chỉnh gần nhất.
- Không tự tính lại biểu đồ khi mở phiên.

## 7. Tài khoản

| Nội dung | Quy tắc đề xuất |
|---|---|
| Username | 3–30 ký tự: chữ Latin, số, `_`, `-`, `.` |
| Chuẩn hóa username | Trim và so khớp không phân biệt hoa/thường |
| Mật khẩu | 15–128 ký tự; cho phép khoảng trắng và Unicode |
| Xử lý mật khẩu | Không trim, không đổi hoa/thường, không lưu dạng thô |
| Phiên không hoạt động | Hết hạn sau 24 giờ không có hoạt động hợp lệ |
| Thời hạn tuyệt đối | Tối đa 7 ngày từ khi đăng nhập |
| Cookie | HttpOnly, SameSite=Lax; Secure khi chạy HTTPS |
| CSRF | Kiểm tra Origin và CSRF token cho request thay đổi dữ liệu |
| CORS | Chỉ cho phép origin frontend đã cấu hình |
| Hết phiên khi offline | Tiếp tục workspace local đã mở; đăng nhập lại trước khi đồng bộ |

- Đăng ký chỉ có username và mật khẩu.
- Đăng ký thành công sử dụng được ngay, không OTP/email.
- Backend kiểm tra quyền sở hữu mọi tài nguyên.
- Phân biệt phiên đăng nhập với phiên làm việc xử lý dữ liệu.
- Các thời hạn phiên là cấu hình đề xuất, không phải mặc định bắt buộc của thư viện.

## 8. Đồng bộ

### Luồng chính

1. Lưu kết quả local hoàn chỉnh.
2. Thêm thay đổi vào hàng đợi.
3. Gửi theo thứ tự phụ thuộc trong từng project.
4. Upload đủ nội dung.
5. Backend kiểm tra và công bố metadata.
6. Nhận xác nhận rồi mới báo Đã đồng bộ.

### Quy tắc xử lý lỗi

| Tình huống | Hướng xử lý |
|---|---|
| Gửi lại | Dùng cùng `operationId`, không tạo bản sao |
| Mất phản hồi | Hỏi trạng thái hoặc gửi lại cùng thao tác |
| Upload dở | Tiếp tục bằng upload ID và danh sách chunk còn thiếu |
| Upload hết hạn | Upload lại từ dữ liệu local, không tạo phiên bản trùng |
| Sai `baseRevision` | Giữ riêng kết quả local; không ghi đè con trỏ server |
| Metadata xung đột | Giữ thay đổi local chờ giải quyết và thông báo rõ |
| Hết đăng nhập | Giữ hàng đợi, yêu cầu đăng nhập trước khi tiếp tục |
| Atlas lỗi | Giữ dữ liệu local và cho thử lại |
| Một project bị lỗi | Không làm mất dữ liệu hoặc chặn vô hạn các project khác |

- Bản cha phải được công bố trước bản con.
- Không dùng đồng hồ máy để tự quyết định bản nào thắng.
- Không đồng bộ bản xem trước chưa áp dụng.
- Không xây thêm giao diện chỉnh sửa nhánh trong bản đầu.
- Thoát phiên không đồng nghĩa đăng xuất hoặc xóa local.

## 9. Hiệu năng và môi trường kiểm chứng

### Môi trường

- Máy chính: MSI Thin 15 của người dùng, RAM 16 GB.
- Trình duyệt chính: Chrome.
- Trình duyệt đối chiếu: Edge.
- Ghi phiên bản hệ điều hành, trình duyệt và môi trường khi kiểm thử.

### Dữ liệu kiểm thử

- Tệp nhỏ có kết quả kỳ vọng xác định.
- CSV gần 20 MB với nhiều dòng.
- CSV nhiều cột.
- CSV chứa văn bản dài.
- Dữ liệu có nhiều missing/outlier.
- Cột phân loại có nhiều nhóm để kiểm tra One-hot.

### Mục tiêu cần đo

- Phản hồi trạng thái đang chạy trong khoảng 0,5 giây.
- Phản hồi yêu cầu hủy trong khoảng 1 giây với tác vụ có thể chia nhỏ.
- Đo thời gian parse, thống kê, xử lý, lưu, mở lại và đồng bộ.
- Đo độ phản hồi UI và khả năng tương tác biểu đồ.
- Chưa cam kết thời gian xử lý toàn bộ hoặc mức RAM trước khi đo.

### Lấy mẫu và giới hạn

- Chưa chốt số điểm hiển thị cố định trước khi đo.
- Nếu lấy mẫu, phải hiển thị số dòng đang vẽ và tổng số dòng.
- Thống kê và xử lý nghiệp vụ vẫn dùng toàn bộ dữ liệu.
- Không tự giới hạn dòng/cột chỉ dựa trên một giả định chưa kiểm chứng.
- Kết quả One-hot có thể lớn hơn CSV đầu vào; phải xem trước số cột và đánh giá khả năng lưu.

## 10. Yêu cầu giao agent

1. Đối chiếu các đề xuất này với hai prompt chính thức.
2. Ghi các quyết định được duyệt vào tài liệu của nhiệm vụ 01.
3. Bổ sung hợp đồng dữ liệu và fixture kiểm tra tương ứng.
4. Phân biệt rõ quy tắc đã chốt, đề xuất còn lại và mục tiêu cần đo.
5. Không báo đạt hiệu năng, offline hoặc tích hợp Atlas nếu chưa kiểm chứng thực tế.
6. Sau khi hoàn tất nhiệm vụ 01, triển khai nền tảng theo kế hoạch đã thống nhất.