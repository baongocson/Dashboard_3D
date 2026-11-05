# PROMPT: TỔNG QUAN CHỨC NĂNG VÀ TƯƠNG TÁC DASHBOARD 3D TIỀN XỬ LÝ DỮ LIỆU

Bạn là agent phân tích và phát triển hệ thống web dashboard 3D phục vụ quan sát chất lượng và tiền xử lý dữ liệu. Hãy sử dụng các yêu cầu dưới đây làm cơ sở thiết kế chức năng, màn hình, nút và hành vi tương tác.

Tài liệu này xác định hành vi sản phẩm. Công nghệ, tài khoản, offline và đồng bộ sử dụng prompt công nghệ đi kèm. Không tự bổ sung yêu cầu ngoài hai tài liệu. Không có AI, SMTP hoặc xuất tệp trong bản đầu.

## Quy tắc sử dụng chung hai tài liệu

Hai prompt là một bộ đặc tả bổ trợ nhau:
- **Prompt chức năng và tương tác** quyết định màn hình, biểu đồ, nút, phương pháp và phạm vi xử lý, xem trước, hoàn tác, lịch sử và hành vi phiên làm việc.
- **Prompt công nghệ và tổ chức triển khai** quyết định stack, Worker, lưu trữ, API, tài khoản, offline, đồng bộ và yêu cầu kỹ thuật/hiệu năng. Tài liệu này cũng là nguồn quy định hành vi tài khoản, offline và đồng bộ, thay vì tự thêm các quy tắc đó vào luồng tiền xử lý.
- Các quy tắc chung ở hai tài liệu phải cùng nghĩa. Khi cần mô tả chi tiết, dẫn chiếu tài liệu sở hữu thay vì tạo một biến thể mới. Không dùng nguyên tắc “tệp đọc sau thắng” hoặc “tệp mới hơn thắng” để âm thầm bỏ yêu cầu.
- Nếu gặp mâu thuẫn thực sự còn lại, ghi rõ hai yêu cầu liên quan, tiếp tục phần độc lập và chỉ hỏi khi quyết định đó ngăn cản công việc.
- Nhiệm vụ giao agent trong từng lần quyết định chỉ thiết kế hay được triển khai, phạm vi sửa và kết quả cần bàn giao. Bản thân hai tài liệu không tự cấp lệnh cài đặt, kết nối/chỉnh sửa Atlas hay triển khai ứng dụng.
- Nếu chỉ nhận hai prompt mà chưa có nhiệm vụ thực thi: mặc định đối chiếu hiện trạng và lập thiết kế/kế hoạch, chưa sửa mã hoặc cài dependency. Khi được giao triển khai rõ ràng, thực hiện phần được giao theo cả hai tài liệu; không bị chặn bởi câu “mặc định chỉ thiết kế”.
- Không tự khôi phục yêu cầu từ thiết kế cũ ngoài bộ tài liệu hiện tại. Phân biệt rõ yêu cầu đã chốt với thư viện, tham số hoặc chi tiết còn được đánh dấu là đề xuất.



## 1. Mục tiêu và phạm vi

- Xây dựng website trực quan hóa 3D cho quy trình từ Collection đến hết Pre-processing.
- Chỉ nhập tệp CSV. Mỗi phiên làm việc có một bộ dữ liệu nguồn; các kết quả xử lý là các trạng thái/phiên bản của bộ dữ liệu đó.
- Hai trang xử lý dữ liệu chính: Collection → Next → Pre-processing. Màn hình tài khoản và danh sách project/phiên là màn hình hỗ trợ, không phải thêm bước tiền xử lý.
- Mỗi project chứa một dataset nguồn và một phiên làm việc có thể lưu/mở lại. Dataset có nhiều phiên bản qua thao tác xử lý. Một tài khoản có thể sở hữu nhiều project độc lập; không bổ sung nhiều dataset hoặc nhiều phiên trong cùng project ở bản đầu.
- “Phiên làm việc” là trạng thái xử lý có thể tiếp tục; “phiên đăng nhập” là trạng thái xác thực tài khoản. Hai khái niệm tách biệt.
- Tạm bỏ Integration; không ghép bảng, nối nhiều tệp hoặc nhập JSON/Excel.
- Pre-processing là một trang gồm nhiều mục chức năng. Người dùng tự chọn thứ tự thao tác, không bắt buộc hoàn tất từng mục tuần tự.
- Chưa thực hiện huấn luyện, đánh giá mô hình, khai phá dữ liệu hoặc xuất tệp dữ liệu.
- Người dùng xem, chọn dữ liệu trên biểu đồ, xem trước thay đổi rồi quyết định áp dụng.
- Có hoàn tác, lịch sử thao tác và lưu/mở lại phiên làm việc. Tự lưu local sau mỗi lần Áp dụng thành công; lưu khi thoát và nút Lưu phiên bổ sung việc lưu trạng thái giao diện/cấu hình đã xác nhận.
- Chỉ sửa dữ liệu trên phiên bản hiện tại. Không bổ sung giao diện chọn phiên bản cũ hoặc tạo nhánh xử lý. Nhánh do xung đột đồng bộ là cơ chế bảo toàn dữ liệu theo prompt công nghệ, không phải trình chỉnh sửa nhánh.
- CSV tối đa 20.000.000 byte (20 MB thập phân), thống nhất với prompt công nghệ; giới hạn này áp dụng tệp nhập, không phải giới hạn bắt buộc của kết quả sau encoding.

## 2. Bố cục và tương tác chung

### 2.1. Bố cục chính

- Thanh trên: tên phiên, mục đang mở, trạng thái dữ liệu/biểu đồ và các điều khiển chung.
- Bên trái: Cleaning, Missing values, Outliers, Chuẩn hóa thang đo, Transformation, Encoding.
- Trung tâm: biểu đồ 3D của mục được chọn.
- Bên phải: cột/phạm vi đang chọn, phương pháp, tham số, nút xem trước và áp dụng.
- Bên dưới: bảng dữ liệu để xem dòng, cột, chọn ô và thao tác chi tiết.
- Thông tin của điểm dữ liệu xuất hiện bằng bảng nổi cạnh chính điểm đó khi rê chuột; không dành một bảng thông tin điểm cố định ở bên phải.
- Có chế độ so sánh trước–sau khi xem trước kết quả.
- Không có bản đồ quy trình 3D riêng. Yếu tố 3D nằm ở các biểu đồ dữ liệu.
- Sau khi tài nguyên và dữ liệu cần thiết đã lưu trên trình duyệt, offline vẫn giữ tương tác 3D, chọn điểm, bảng nổi, bảng dữ liệu và xử lý. “Tĩnh” chỉ có nghĩa dữ liệu không tự cập nhật khi chưa chạy lại, không phải ảnh chụp thay cho biểu đồ tương tác.

### 2.2. Quy tắc chọn và xem thông tin

- Rê chuột vào điểm: hiện bảng thông tin nổi gắn với điểm, gồm định danh dòng, các giá trị liên quan, trạng thái thiếu/ngoại lệ và thông tin phù hợp với mục.
- Nhấn điểm: chọn dòng tương ứng và mở bảng chi tiết để chọn ô xử lý.
- Đề xuất tương tác cần áp dụng nhất quán: nhấn điểm để ghim bảng nổi; cho phép đưa chuột vào bảng; có nút Đóng hoặc nhấn ra ngoài để bỏ ghim. Đây là chi tiết bổ sung nhằm làm thao tác ổn định.
- Rê chuột chỉ xem; không sửa dữ liệu. Nhấn chọn ô mới xác định ô đích của thao tác riêng.
- Dùng định danh dòng ổn định để ánh xạ giữa điểm và bảng, kể cả sau sắp xếp/xóa dòng. Không nhầm số thứ tự hiển thị với định danh dòng.
- Đối tượng tổng hợp như một cột histogram đại diện cho nhiều dòng phải mở danh sách dòng liên quan và ghi rõ số lượng; không giả làm một điểm dữ liệu đơn.

### 2.3. Các nút chung

| Nút | Hành vi |
|---|---|
| Phóng to / Thu nhỏ | Thay đổi mức quan sát biểu đồ, không sửa dữ liệu |
| Đặt lại góc nhìn | Trả camera về góc mặc định |
| Chạy lại biểu đồ | Tính lại biểu đồ của mục đang mở trên dữ liệu hiện tại |
| So sánh trước–sau | Hiển thị dữ liệu đầu vào và kết quả xem trước của cùng thao tác |
| Xem trước | Tính kết quả dự kiến, chưa thay đổi dữ liệu chính |
| Áp dụng | Xác nhận kết quả, cập nhật dữ liệu và thêm lịch sử |
| Hủy | Bỏ bản xem trước/cấu hình chưa áp dụng |
| Hoàn tác | Quay lại trạng thái dữ liệu trước thao tác áp dụng gần nhất |
| Lịch sử thao tác | Xem thứ tự thực tế, phương pháp, cột/phạm vi, tham số và số ô/dòng bị ảnh hưởng |
| Lưu phiên | Lưu chủ động trạng thái làm việc; không thay thế tự lưu sau Áp dụng |
| Thoát phiên | Lưu trạng thái rồi về danh sách project/phiên; không đăng xuất và không xóa dữ liệu |

Nút Áp dụng chỉ khả dụng khi cấu hình hợp lệ và có bản xem trước phù hợp với dữ liệu hiện tại. Nếu cấu hình hoặc dữ liệu thay đổi sau xem trước, yêu cầu xem trước lại.

## 3. Collection

### 3.1. Luồng chức năng

1. Người dùng chọn hoặc kéo thả một tệp CSV.
2. Hệ thống kiểm tra tệp và đọc cấu trúc dữ liệu; thông báo rõ nếu không đọc được, tệp rỗng hoặc cấu trúc dòng không hợp lệ.
3. Hiển thị bảng dữ liệu và thông tin tổng quan.
4. Người dùng nhấn Next để chuyển sang Pre-processing.

### 3.2. Nội dung hiển thị

- Tên tệp, dung lượng tệp gốc, số dòng dữ liệu và số cột; làm rõ dòng tiêu đề không tính là bản ghi.
- Số ô thiếu, tỷ lệ thiếu và số dòng có ít nhất một ô thiếu.
- Số bản ghi trùng; ghi rõ quy tắc nhận diện. Đề xuất mặc định là trùng toàn bộ cột và đếm số dòng dư ngoài dòng giữ lại đầu tiên.
- Số giá trị ngoại lệ và số dòng có ngoại lệ, kèm phương pháp/ngưỡng dùng để tính; chỉ tính trên các cột phù hợp.
- Ma trận tương quan giữa các cột số phù hợp. Phải thể hiện trường hợp không tính được, ví dụ cột hằng hoặc không đủ cặp giá trị hợp lệ; không thay bằng hệ số 0.
- Bảng xem dữ liệu gốc.

### 3.3. Các nút

| Nút | Hành vi |
|---|---|
| Chọn tệp CSV | Chọn một tệp đầu vào |
| Phân tích dữ liệu / Chạy lại | Tính thống kê và biểu đồ Collection |
| Next | Sang Pre-processing; chỉ bật khi đã đọc dữ liệu thành công |

Collection phản ánh dữ liệu nguồn. Xử lý trong Pre-processing không tự sửa biểu đồ hoặc thống kê Collection đã tạo.

## 4. Các biểu đồ 3D

| Mục | Biểu diễn |
|---|---|
| Collection | Thẻ số liệu, biểu đồ chất lượng và ma trận tương quan trong không gian 3D |
| Missing | Mỗi điểm là một dòng; X = thứ tự dòng, Y = số ô thiếu, Z = số ô hợp lệ; màu đậm dần theo tỷ lệ thiếu |
| Outlier | X = thứ tự dòng, Y = giá trị cột số đang kiểm tra, Z = cột số phụ tùy chọn; đánh dấu ngoại lệ, hiển thị mặt phẳng biên |
| Cleaning | X = cột dữ liệu, Y = loại vấn đề, Z = số ô bị ảnh hưởng |
| Chuẩn hóa / Transformation | X = khoảng giá trị, Y = trước/sau, Z = số bản ghi; quan sát theo từng cột được chọn |
| Encoding | X = nhóm giá trị, Y = cột được chọn, Z = số bản ghi; kèm bảng ánh xạ |

- Ma trận tương quan: hai trục là tên cột, màu biểu thị hệ số từ −1 đến 1; giữ các ô cùng chiều cao, nhấn ô xem hệ số và cặp cột.
- Với Missing, số ô thiếu và số ô hợp lệ có quan hệ phụ thuộc; không trình bày các trục như ba đặc trưng độc lập. Màu cần có chú giải tỷ lệ thiếu.
- Nếu không có cột số phụ, Outlier vẫn hoạt động trên một mặt phẳng trong cảnh 3D; không tạo tọa độ dữ liệu giả.
- Mọi biểu đồ ghi rõ cột, đơn vị, ý nghĩa trục, phiên bản dữ liệu và phạm vi hiển thị.
- Nếu chỉ hiển thị mẫu hoặc nhóm điểm do số lượng lớn, phải công khai số dòng hiển thị/tổng số dòng. Các thống kê và xử lý toàn bộ không được âm thầm chỉ chạy trên mẫu.

## 5. Cleaning

Hỗ trợ:
- Xóa bản ghi trùng.
- Bỏ khoảng trắng thừa.
- Loại HTML khỏi nội dung văn bản.
- Thống nhất ký hiệu thiếu.
- Sửa/chuyển kiểu dữ liệu.
- Chuẩn hóa ngày tháng.
- Đổi tên và xóa cột.

Các nút: Chọn cột → Chọn thao tác → Cấu hình → Xem trước → Áp dụng / Hủy.

Yêu cầu hành vi:
- Xem trước số ô/dòng thay đổi và các ví dụ trước–sau.
- Xóa trùng: mặc định giữ dòng xuất hiện đầu tiên; quy tắc phải hiển thị.
- Quy tắc ký hiệu thiếu phải có thể xem được; không tự coi giá trị hợp lệ như 0 là missing.
- Chuyển kiểu/ngày tháng: liệt kê giá trị không chuyển được; không âm thầm làm mất dữ liệu hoặc suy đoán ngày tháng nhập nhằng.
- Đổi tên: kiểm tra tên rỗng/trùng. Xóa cột: xem trước cột và ảnh hưởng liên quan.

## 6. Missing values

### 6.1. Quan sát và xử lý riêng

1. Rê chuột xem thông tin dòng và tỷ lệ thiếu.
2. Nhấn điểm để mở bảng dòng tương ứng; các ô thiếu được đánh dấu.
3. Nhấn chọn ô cần xử lý.
4. Chọn nhập giá trị hoặc phương pháp → Xem trước → Áp dụng.

Các nút riêng: Điền giá trị, Chọn phương pháp, Xóa dòng, Xóa cột, Xem trước, Áp dụng, Hủy.

- Điền một ô chỉ sửa ô đang chọn; trung bình/trung vị/mode được tính từ giá trị hợp lệ của cột theo phạm vi cấu hình, không tính từ riêng một ô.
- Xóa dòng/xóa cột phải ghi rõ phạm vi lớn hơn ô đang chọn.

### 6.2. Xử lý hàng loạt

Nút Xử lý missing toàn bộ mở bảng cấu hình theo cột. Mỗi cột có thể chọn phương pháp khác nhau hoặc bỏ qua.

| Phương pháp | Điều kiện/hành vi |
|---|---|
| Xóa dòng | Xem trước các dòng sẽ bị xóa theo cột/điều kiện đã chọn |
| Trung bình | Cột số |
| Trung vị | Cột số |
| Giá trị xuất hiện nhiều nhất | Hiển thị cách xử lý nếu có nhiều giá trị đồng hạng |
| Giá trị cố định | Kiểm tra tương thích kiểu dữ liệu |
| Điền tiến / Điền lùi | Dùng thứ tự dòng mặc định hoặc cột sắp xếp do người dùng chọn |
| Nội suy | Chỉ cung cấp khi kiểu dữ liệu và trục thứ tự phù hợp |

- Cho phép chọn cột sắp xếp và chiều sắp xếp; xem trước thứ tự sử dụng. Chỉ đổi thứ tự đầu ra nếu người dùng chủ động chọn hành vi đó.
- Không đủ giá trị hợp lệ, cột thiếu hoàn toàn hoặc thiếu ở đầu/cuối chưa xử lý được: thông báo rõ, không tự bịa giá trị.
- Phương pháp không tương thích phải bị vô hiệu hóa kèm lý do.

## 7. Outliers

### 7.1. Phát hiện

- Chọn một hoặc nhiều cột số; phát hiện theo từng cột.
- IQR: mặc định k = 1.5; IQR = Q3 − Q1; biên dưới = Q1 − k×IQR; biên trên = Q3 + k×IQR.
- Z-score: mặc định ngưỡng |z| > 3; cho cấu hình ngưỡng.
- Biên được hệ thống tính và hiển thị cùng phương pháp/tham số.
- Cột hằng, độ lệch chuẩn bằng 0, IQR bằng 0 hoặc không đủ dữ liệu cần được xử lý rõ ràng, không gây kết quả vô hạn/không hợp lệ.

Các nút: Chọn cột, Chọn phương pháp, Phát hiện / Chạy lại, Chỉ hiện ngoại lệ.

### 7.2. Xử lý

| Nút | Hành vi |
|---|---|
| Xóa dòng | Xóa dòng chứa điểm được chọn; xử lý hàng loạt phải cấu hình rõ các dòng bị ảnh hưởng |
| Kéo về biên | Chỉ đưa giá trị ngoài biên về biên gần nhất do hệ thống đã tính |
| Transformation | Mở cấu hình biến đổi cho một hoặc nhiều cột; áp dụng toàn bộ giá trị trong cột được chọn |

- Phân biệt thao tác một điểm và hàng loạt bằng nhãn phạm vi rõ ràng.
- Một dòng có ngoại lệ ở nhiều cột chỉ bị xóa một lần.
- Transformation không bảo đảm loại bỏ ngoại lệ; sau biến đổi, người dùng chạy lại phát hiện để đánh giá.

## 8. Chuẩn hóa thang đo

- Min–Max: mặc định [0, 1], cho cấu hình khoảng hợp lệ.
- Standard: trừ trung bình và chia độ lệch chuẩn.
- Robust: trừ trung vị và chia IQR.

Luồng nút: Chọn một/nhiều cột số → Chọn phương pháp → Cấu hình → Xem trước → Áp dụng / Hủy.

Tính tham số riêng cho từng cột. Hiển thị thống kê trước–sau. Không chia cho 0; cột không đáp ứng phải có thông báo và cách bỏ qua rõ ràng.

## 9. Transformation

- Log1p: y = ln(1+x), yêu cầu x > −1.
- Căn bậc hai: yêu cầu x ≥ 0.
- Yeo–Johnson: hỗ trợ số âm, 0, số dương; lưu tham số đã tính theo từng cột.

Luồng nút: Chọn một/nhiều cột số → Chọn phương pháp → Kiểm tra điều kiện → Xem trước → Áp dụng / Hủy.

Áp dụng toàn bộ giá trị hợp lệ của từng cột đã chọn. Không tự thêm hằng số để ép dữ liệu vào miền xác định. Hiển thị các giá trị vi phạm và yêu cầu người dùng điều chỉnh phạm vi/phương pháp trước khi áp dụng. Missing phải được giữ hoặc xử lý theo quy tắc đã công khai, không âm thầm đổi thành 0.

## 10. Encoding

- One-hot: tạo cột chỉ báo cho các nhóm; hiển thị số cột dự kiến và tên cột đầu ra trước khi áp dụng.
- Ordinal: người dùng xác định thứ tự nhóm và xem bảng ánh xạ; không tự coi thứ tự chữ cái là thứ bậc nghiệp vụ.
- Frequency encoding và các phương pháp khác chưa nằm trong bộ bắt buộc của bản đầu.

Luồng nút: Chọn cột phân loại → Chọn phương pháp → Cấu hình/Thứ tự nhóm → Xem ánh xạ → Xem trước → Áp dụng / Hủy.

Cấu hình phải nêu rõ giữ hay thay cột gốc, quy tắc missing, tên cột đầu ra và xử lý trùng tên. Với quá nhiều nhóm, thông báo số cột sẽ tăng để người dùng quyết định; không tự âm thầm gộp nhóm.

## 11. Xem trước, lịch sử và dữ liệu của từng bước

- Mỗi thao tác dùng dữ liệu hiện tại làm đầu vào và tạo trạng thái mới sau khi Áp dụng. Xem trước chưa tạo phiên bản dữ liệu chính hoặc bản ghi đồng bộ kết quả.
- Áp dụng chỉ được báo thành công khi dữ liệu kết quả, metadata, lịch sử và bản ghi chờ đồng bộ đã được lưu local nhất quán. Ghi local lỗi thì giữ phiên bản hiện tại trước thao tác; bản xem trước có thể giữ trong bộ nhớ để thử lại. Không báo thành công chỉ vì Worker đã tính xong.
- Bản xem trước nêu phương pháp, cột/phạm vi, tham số, số dòng/cột/ô thay đổi, lỗi và mẫu trước–sau.
- Hủy xem trước không thay đổi dữ liệu chính hoặc thêm lịch sử xử lý thành công.
- Lịch sử ghi thứ tự thực tế, không phụ thuộc thứ tự mục trên thanh bên.
- Hoàn tác khôi phục dữ liệu và cấu trúc cột trước thao tác, kể cả thao tác xóa dòng/cột hoặc encoding.
- Dữ liệu đầu vào và kết quả cần đủ thông tin để giải thích từng thao tác; không ghi đè mất dữ liệu nguồn.

### Quy tắc biểu đồ bắt buộc

- Không tự tính lại thống kê/biểu đồ sau mỗi thao tác Áp dụng.
- Chỉ tính lại biểu đồ của mục khi người dùng chủ động Chạy lại biểu đồ.
- Biểu đồ trước đó giữ liên kết với trạng thái dữ liệu tại lần tạo; không lấy dữ liệu mới để thay ngầm.
- Hiển thị phiên bản đang vẽ và nhãn Dữ liệu đã thay đổi — cần chạy lại khi phù hợp.
- Nếu nhấn một điểm trên biểu đồ cũ, chỉ cho xem dữ liệu của phiên bản đó; phải chuyển/chạy lại trên dữ liệu hiện tại trước khi sửa. Không áp dụng thao tác nhầm vào dòng cùng vị trí ở phiên bản khác.
- Sau hoàn tác, đối chiếu lại phiên bản để xác định trạng thái biểu đồ.

## 12. Project và phiên làm việc

- Danh sách project/phiên hiển thị tối thiểu tên project, tên CSV nguồn và thời điểm cập nhật. Mỗi project trong bản đầu có đúng một dataset nguồn và một phiên làm việc tiếp tục được.
- Tạo project/phiên mới dẫn vào Collection để nhập CSV. Nhấn Mở phiên khôi phục trạng thái đã lưu, không yêu cầu nhập lại tệp.
- Các nút: Tạo project, Mở phiên, Lưu phiên, Thoát phiên. Chưa bổ sung xóa project/phiên, chia sẻ hoặc quản lý nhiều dataset trong một project.
- Lưu dữ liệu gốc, dữ liệu hiện tại, lịch sử/thông tin phục vụ hoàn tác, cấu hình và kết quả biểu đồ cùng phiên bản nguồn, mục đang mở. Bản xem trước chưa áp dụng không bắt buộc được khôi phục và không được coi là dữ liệu chính.
- Tự lưu local sau mỗi lần Áp dụng thành công. Nút Lưu phiên lưu chủ động trạng thái còn lại; khi Thoát phiên phải chờ lưu thành công rồi về danh sách.
- Có trạng thái Đang lưu, Đã lưu trên máy và Lưu lỗi; trạng thái đồng bộ riêng theo prompt công nghệ. Đã lưu trên máy không đồng nghĩa đã đồng bộ Atlas.
- Nếu lưu lỗi hoặc hết quota: không báo đã lưu, không tự thoát hoặc xóa trạng thái còn trong bộ nhớ; hiển thị lỗi và nút Thử lưu lại. Chưa triển khai xuất tệp kể cả xuất cứu hộ.
- Đóng tab đột ngột không thể bảo đảm một lần ghi cuối hoàn tất. Khi mở lại, khôi phục lần lưu hoàn chỉnh gần nhất, không hứa khôi phục cấu hình chưa lưu.
- Thoát phiên khác Đăng xuất tài khoản. Thoát phiên giữ dữ liệu local; đăng xuất áp dụng chính sách riêng trong prompt công nghệ và phải giải thích khi lựa chọn đó xóa dữ liệu chưa đồng bộ.
- Khi online và ứng dụng đang mở, tự đồng bộ kết quả đã lưu; có Đồng bộ ngay/Thử lại theo prompt công nghệ. Offline tiếp tục làm việc với dữ liệu local đã có.
- Không có nút xuất CSV/JSON, tải bộ dữ liệu kết quả hoặc xuất cứu hộ trong bản đầu.

## 13. Kiểm tra đầu vào và trạng thái giao diện

- Kiểm tra CSV, cấu hình cột, kiểu dữ liệu, tham số, miền xác định và điều kiện tính trước khi xử lý.
- Giữ rõ các trạng thái: chưa có dữ liệu, sẵn sàng, đang chạy, đang xem trước, đã áp dụng, không có thay đổi, lỗi.
- Không cho thực hiện hai thao tác ghi dữ liệu xung đột cùng lúc.
- Lỗi phải chỉ ra cột/giá trị/phương pháp liên quan và giữ dữ liệu trước thao tác.
- Thông báo không có missing/outlier hoặc không có cột phù hợp thay vì để màn hình trống.
- Quy tắc missing, duplicate, ngoại lệ, tương quan và nội suy phải nhất quán giữa Collection và Pre-processing hoặc hiển thị rõ khác biệt cấu hình.

## 14. Kịch bản nghiệm thu chức năng

1. Nhập CSV hợp lệ → xem thống kê và biểu đồ Collection → Next sang Pre-processing.
2. Mở các mục theo thứ tự tùy ý; dữ liệu đầu vào luôn là trạng thái hiện tại.
3. Rê chuột điểm Missing → xem bảng nổi → nhấn điểm và chọn ô → xem trước điền → áp dụng chỉ ô đã chọn.
4. Xử lý missing toàn bộ với trung vị cho cột A và mode cho cột B; các cột bỏ qua không thay đổi.
5. Điền tiến/lùi hoặc nội suy với cột sắp xếp; ánh xạ dòng vẫn chính xác.
6. Phát hiện IQR/Z-score → chọn ngoại lệ → xem trước xóa dòng hoặc kéo về biên → áp dụng đúng phạm vi.
7. Transformation nhiều cột áp dụng cả cột; giá trị vi phạm điều kiện được báo trước khi thay đổi.
8. Chạy Min–Max/Standard/Robust, xem phân bố trước–sau và xử lý rõ cột hằng.
9. One-hot hiển thị đúng số cột dự kiến; Ordinal tuân theo thứ tự người dùng chọn.
10. Hủy xem trước giữ nguyên dữ liệu; hoàn tác khôi phục cả nội dung và cấu trúc.
11. Áp dụng bước sau không làm đổi biểu đồ bước trước; Chạy lại chỉ cập nhật biểu đồ mục hiện tại. Điểm trên biểu đồ cũ không sửa nhầm dữ liệu mới.
12. Áp dụng → tự lưu thành công → Thoát phiên → Mở phiên → tiếp tục đúng dữ liệu, lịch sử và biểu đồ đã lưu.
13. Lưu local lỗi/hết quota không báo đã áp dụng thành công; giữ trạng thái trước thao tác và cho thử lại, không tự xuất tệp hoặc thoát.
14. Offline sau khi chuẩn bị tài nguyên: phóng to/chọn điểm/bảng nổi/xử lý vẫn hoạt động; online trở lại tự đồng bộ khi ứng dụng mở.
15. Không có bản đồ quy trình 3D riêng hoặc giao diện chọn phiên bản cũ để sửa.

## 15. Yêu cầu đối với agent khi sử dụng prompt

- Đối chiếu yêu cầu với hiện trạng dự án trước khi đề xuất hoặc sửa mã.
- Nếu nhiệm vụ là thiết kế: trả về danh sách màn hình, thành phần, nút, điều kiện bật/tắt và luồng tương tác theo tài liệu này; chưa tự triển khai.
- Nếu được giao triển khai: làm theo phạm vi nhiệm vụ cụ thể và công nghệ đã được thống nhất riêng; không tự mở rộng tính năng.
- Phân biệt yêu cầu đã chốt, chi tiết đề xuất bổ sung và điểm chưa quyết định. Không tuyên bố chức năng đã hoàn thành nếu chưa có bằng chứng chạy thực tế.
- Những chi tiết còn cần đặc tả như cách tính tương quan, quy tắc đồng hạng mode và nội suy phải được nêu rõ; giới hạn CSV và chính sách tự lưu đã chốt trong bộ tài liệu này; không lấy thiết kế cũ ngoài cuộc trao đổi này để tự thay đổi phạm vi.
