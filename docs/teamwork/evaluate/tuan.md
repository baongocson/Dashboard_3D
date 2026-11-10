# Đánh giá phần việc của Tuấn — Backend Project, Data và Sync

## 1. Phạm vi đánh giá

- Ngày đánh giá: 10/11/2026, múi giờ Asia/Saigon.
- Nhánh: `codex/tuan-backend-data-sync`.
- Commit được kiểm tra: `1d19e1ead12053f8ad8947566b4de03c95b35ce0`.
- Commit mới so với nền tảng: `1d19e1e — docs: add Tuan progress report`.
- Thay đổi: **1 file mới, 109 dòng**, toàn bộ là `docs/teamwork/tuan.md`.
- Căn cứ: [Phân công chính, mục 6](../phan-cong-thanh-vien.md#6-tuấn--backend-project-dữ-liệu-và-sync), [baseline nhiệm vụ 01](../../architecture/task-01-decisions.md) và báo cáo của Tuấn trên nhánh.
- Đã đối chiếu commit trực tiếp với GitHub, đọc báo cáo, kiểm tra diff và danh sách file. Chưa merge, sửa hoặc push code.
- Kết luận áp dụng cho nội dung đã push tại commit trên; không suy đoán về mã có thể đang nằm trên máy cá nhân hoặc chưa được đưa lên nhánh này.

## 2. Kết luận

**Nhánh đã có báo cáo tiến độ nhưng chưa có mã triển khai mới cho backend Project, Data và Sync. Nhiệm vụ được giao chưa hoàn thành và chưa có phần mã nguồn nghiệp vụ để nghiệm thu hoặc merge.**

Mã trong `apps/`, `packages/`, `tests/`, `package.json` và `package-lock.json` không khác `origin/main` tại thời điểm kiểm tra. Nhánh chưa có các module nghiệp vụ `projects`, `datasets`, `versions`, `sessions`, `charts`, `sync`, hoặc client sync coordinator tại `apps/web/src/sync`.

Báo cáo đã nói rõ phần chưa triển khai và các phụ thuộc cần phối hợp. Tuy nhiên, kết quả kiểm chứng nhiệm vụ 01–02 được dẫn lại là kết quả của nền tảng dự án, không chứng minh Tuấn đã thực hiện các tính năng backend được phân công.

## 3. Những phần ghi nhận được

| Nội dung                             | Bằng chứng                                                                                | Đánh giá                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Tạo nhánh và push báo cáo            | Nhánh tồn tại trên GitHub; có commit thêm `docs/teamwork/tuan.md`                         | Đã bàn giao tài liệu tiến độ                                                  |
| Tổng hợp hiện trạng nền tảng         | Báo cáo dẫn lại `docs/testing/task-01-02-results.md`                                      | Có tham chiếu nguồn; chưa phải kết quả chạy mới hoặc sản phẩm backend cá nhân |
| Kiểm tra repository trước triển khai | Báo cáo mô tả việc xem thư mục, tìm storage và kiểm tra Git                               | Là hoạt động chuẩn bị do Tuấn ghi nhận; chưa tạo tính năng mới                |
| Nhận diện phụ thuộc                  | Có ghi cần schema/interface từ Trâm, request/response với Phát và auth/ownership với Phúc | Đúng hướng phối hợp; chưa có contract API cụ thể được bàn giao trên nhánh     |
| Công bố giới hạn                     | Ghi rõ chưa làm publication/recovery, API nghiệp vụ và sync                               | Phản ánh trung thực phạm vi chưa hoàn thành                                   |

Không có thay đổi mã nguồn mới để đánh giá chất lượng thuật toán, API, tính đúng của transaction hoặc khả năng xử lý lỗi trong nhánh này.

## 4. Đối chiếu từng nhiệm vụ được giao

| Yêu cầu theo phân công                                               | Bằng chứng trên nhánh                                                                     | Kết luận                                           |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Chốt schema lưu với Trâm và request/response tạo/mở project với Phát | Báo cáo ghi đang chờ thống nhất; chưa có hợp đồng API/schema nghiệp vụ mới                | Chưa hoàn thành                                    |
| Tạo project → lưu MongoDB → đọc lại → frontend hiển thị              | Chưa có route, service, repository hoặc kiểm thử cho luồng này                            | Chưa triển khai trên nhánh                         |
| Kiểm tra ownership bằng giao diện auth của Phúc                      | Chưa có API tài nguyên cần bảo vệ hoặc tích hợp requireAuth/requireOwned                  | Chưa triển khai trên nhánh                         |
| Lưu chunk và publication dataset/version phía server                 | Chưa có module, trạng thái staging/publication hoặc bằng chứng công bố dữ liệu hoàn chỉnh | Chưa triển khai trên nhánh                         |
| Upload/resume, operation ID ổn định, retry/mất ACK không tạo bản sao | Chưa có endpoint, lưu trạng thái upload hoặc kiểm thử idempotency                         | Chưa triển khai trên nhánh                         |
| Xử lý baseRevision conflict, bảo toàn dữ liệu local/server           | Chưa có giao thức conflict hoặc ca kiểm chứng                                             | Chưa triển khai trên nhánh                         |
| Nối outbox client với API, xử lý hết auth và Atlas lỗi               | Chưa có client sync coordinator hoặc API sync                                             | Chưa triển khai trên nhánh                         |
| Tài liệu kiểm chứng backend mới                                      | Chỉ dẫn lại kết quả nền tảng 01–02                                                        | Chưa có bằng chứng kiểm chứng cho nhiệm vụ cá nhân |

Theo tiêu chí hoàn thành trong phân công, cần API thật có ownership, retry không tạo bản sao, publication chưa đủ không hiện là đã đồng bộ và conflict không làm mất dữ liệu. Hiện chưa có bằng chứng đạt bất kỳ luồng nghiệp vụ nào trong nhóm tiêu chí này.

## 5. Điểm cần điều chỉnh trong hướng triển khai và báo cáo

### TUAN-01 — Chưa có đầu ra backend tối thiểu để tích hợp

Việc đầu tiên được giao là một lát nhỏ tạo/lưu/đọc project theo hợp đồng chung, không phải viết toàn bộ sync ngay từ đầu. Nhánh hiện chưa có lát này hoặc bản nháp endpoint/request/response để các bên review.

Đề nghị bàn giao hợp đồng API và triển khai phần project nhỏ trước. Khi interface phụ thuộc chưa được chốt, có thể soạn bản nháp và ví dụ lỗi/response để nhóm thống nhất; cần ghi rõ trạng thái đề xuất, không tự coi là quyết định cuối cùng.

### TUAN-02 — Cần tách rõ trách nhiệm storage local và backend dữ liệu/sync

Báo cáo tập trung nhiều vào nhiệm vụ 03 IndexedDB publication/recovery. Theo phân công chính:

- Trâm phụ trách database/config và storage IndexedDB.
- Tuấn phụ trách các module tài nguyên phía backend và điều phối sync phía client, phối hợp với Trâm về cấu trúc lưu và outbox.

Chốt hợp đồng local storage là phụ thuộc cần thiết cho tích hợp sync, nhưng không thay thế đầu ra backend project được giao cho Tuấn. Cần cập nhật kế hoạch theo đúng ownership, tránh cả hai cùng chờ hoặc cùng làm một lớp storage song song.

### TUAN-03 — Kết quả tìm kiếm trong nhánh riêng chưa phản ánh toàn bộ công việc nhóm

Báo cáo ghi chưa tìm thấy storage/Dexie trong repository đã quét. Điều này phù hợp với cây nền tảng mà nhánh Tuấn đang dựa vào, nhưng không chứng minh cả nhóm chưa có storage.

Tại thời điểm review, nhánh Trâm đã có mã storage và nhánh Phúc đã có auth/ownership helper. Các phần đó chưa merge vào main nên không tự xuất hiện trong nhánh Tuấn. Cần đối chiếu các nhánh liên quan hoặc tài liệu bàn giao khi xác định phụ thuộc; không tự merge mã chưa review chỉ để có đủ thư mục.

### TUAN-04 — Phân biệt kết quả nền tảng cũ với bằng chứng cá nhân

Báo cáo đã có chú thích kết quả 01–02 không phải nghiệm thu toàn sản phẩm. Tuy nhiên, đặt kết quả đó dưới mục công việc đã hoàn thành dễ khiến người đọc hiểu là phần backend cá nhân đã được kiểm tra.

Nên tách thành hai mục: “Nền tảng kế thừa và kết quả tham chiếu” và “Đầu ra cá nhân đã push/đã kiểm chứng”. Mỗi đầu ra cá nhân cần có file/endpoint, commit, lệnh chạy, expected/actual và phần chưa kiểm chứng.

Các điểm trên là khoảng trống về triển khai/bàn giao, không phải lỗi runtime được tái hiện. Chưa có mã nghiệp vụ mới để kết luận bug kỹ thuật hoặc đánh giá hiệu năng.

## 6. Những kiểm tra đã thực hiện

| Kiểm tra                                                        | Kết quả                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| GitHub branch head                                              | `1d19e1e`, khớp remote ref đang review                                      |
| Commit mới so với main                                          | 1 commit thêm báo cáo                                                       |
| File thay đổi                                                   | Chỉ `docs/teamwork/tuan.md`, thêm 109 dòng                                  |
| Diff mã ứng dụng/packages/tests/dependencies so với origin/main | Không có thay đổi                                                           |
| Danh sách file backend                                          | Chỉ có app/server và test nền tảng; chưa có các module nghiệp vụ được giao  |
| Đọc báo cáo và đối chiếu phân công                              | Đã thực hiện                                                                |
| Chạy lại unit/build/E2E                                         | Không chạy lại: nhánh chỉ thay đổi tài liệu, không có mã mới cần kiểm chứng |
| MongoDB/Atlas, retry/conflict/ACK và dữ liệu thật               | Không thực hiện; chưa có triển khai nghiệp vụ để chạy                       |

Các số 16 unit tests và 2 E2E tests trong báo cáo của Tuấn là kết quả nền tảng trước đây, không được tính là tests mới của lượt review này hoặc bằng chứng backend/sync đã hoàn thành.

## 7. Thứ tự hoàn thiện đề xuất

1. Đối chiếu auth contract/helper của Phúc, thiết kế database/storage của Trâm và contracts chung; lập danh sách điểm phải chốt với các bên.
2. Soạn hợp đồng tối thiểu tạo/đọc project: endpoint, request/response, lỗi, ownerId lấy từ session server và quan hệ một project–một nguồn–một phiên.
3. Triển khai một lát nhỏ project API với repository MongoDB theo interface đã thống nhất. Không lấy ownerId từ body để quyết định quyền.
4. Kiểm tra chưa đăng nhập, tài khoản A/B, tài nguyên không tồn tại, lưu/đọc và lỗi database. Phân biệt test double với kiểm chứng MongoDB thật.
5. Phối hợp Phát nối luồng tạo/đọc project trên giao diện; ghi bằng chứng expected/actual của luồng nhỏ trước khi mở rộng.
6. Tiếp tục dataset/version chunk publication, upload/resume và operation ID idempotent; chỉ ACK sau công bố đầy đủ.
7. Tích hợp outbox với Trâm/Phát; kiểm tra retry, mất ACK, hết auth, lỗi Atlas và conflict bảo toàn dữ liệu.
8. Push mã theo từng phần nhỏ có kiểm thử, cập nhật báo cáo theo commit và gửi review trước khi merge.

**Trạng thái đánh giá: Đã có báo cáo chuẩn bị; chưa có mã nghiệp vụ mới trên nhánh và chưa hoàn thành nhiệm vụ backend Project, Data và Sync.**
