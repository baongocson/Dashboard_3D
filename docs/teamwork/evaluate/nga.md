# Đánh giá phần việc của Nga — Frontend 3D và tương tác dữ liệu

## 1. Phạm vi đánh giá

- Ngày đánh giá: 10/11/2026, múi giờ Asia/Saigon.
- Nhánh: `codex/nga-frontend-3d`.
- Commit được kiểm tra: `52f531c8f824b446f40902b0fe965769b6167b34`.
- Nhánh có 14 commit mới so với nền tảng; diff cuối cùng gồm 7 file, thêm 1.600 dòng.
- Căn cứ: [Phân công chính, mục 4](../phan-cong-thanh-vien.md#4-nga--frontend-3d-và-kiểm-thử-tương-tác), [baseline nhiệm vụ 01](../../architecture/task-01-decisions.md), mã nguồn và `docs/teamwork/nga_bao_cao.md` trên nhánh.
- Đã đọc diff, kiểm tra cấu trúc bàn giao, chạy kiểm tra trong bản sao riêng và tái hiện các ca dữ liệu bên dưới. Chưa merge, sửa hoặc push mã nguồn của Nga.
- Kết luận chỉ áp dụng nội dung đã push tại commit trên; không đánh giá bản chạy có thể còn nằm trên máy cá nhân.

## 2. Kết luận

**Đã có mã prototype scene 3D và giao diện minh họa, nhưng bản bàn giao chưa được nối vào ứng dụng chạy được của repo. Chưa hoàn thành nhiệm vụ frontend 3D và chưa nên merge nguyên trạng.**

Scene có cấu trúc R3F/Three, camera, OrbitControls, scatter, bar chart, click/hover và popup. App prototype có shared row selection với bảng, bộ lọc và phân trang. Tuy nhiên, các phần này nằm ở `web/src/` thay vì workspace `apps/web/src/`; entrypoint hiện tại vẫn chạy màn hình nền tảng cũ.

Prototype còn sai đường dẫn import, thiếu dependency và lỗi strict TypeScript khi kiểm tra trực tiếp. Callback chưa trả selection ô theo contracts, chưa quản lý chart source version, chưa có preview hoặc lưu/khôi phục camera. Bộ test mới chưa chạy đúng và chưa kiểm chứng tương tác WebGL.

## 3. Các file đã bàn giao

```text
docs/teamwork/nga_bao_cao.md
tests/e2e/structure.test.mjs
web/src/App.tsx
web/src/scene/1
web/src/scene/Scene3D.tsx
web/src/scene/data.ts
web/src/styles.css
```

Không có thay đổi trong `apps/`, `packages/`, `package.json` hoặc `package-lock.json` so với `origin/main` tại thời điểm kiểm tra. Thư mục `web/` mới không có package manifest hoặc entrypoint riêng để chạy prototype độc lập bằng các lệnh hiện có.

## 4. Những phần ghi nhận được từ mã nguồn

| Hạng mục              | Mã đã có                                                                                             | Mức kiểm chứng                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Scene 3D              | Canvas, camera ban đầu, đèn, scatter spheres, bar geometry, vật liệu và OrbitControls                | Đã đọc source; chưa xác minh scene chạy từ checkout hiện tại vì lỗi bàn giao/integration |
| Xoay và zoom          | OrbitControls với giới hạn góc/khoảng cách                                                           | Có cấu hình; chưa có browser interaction test chạy scene                                 |
| Hover/click           | Điểm/cột có handler, hiệu ứng chọn, popup Html                                                       | Có code, chưa có kiểm chứng raycast chọn đúng điểm/ô                                     |
| Bảng và selection     | Prototype dùng selectedId chung cho điểm và dòng bảng; chọn điểm có logic chuyển tới trang chứa dòng | Có luồng row selection; chưa tích hợp với UI Phát và chưa chọn đúng ô theo contracts     |
| Hiển thị dữ liệu      | Scatter, tỷ lệ missing theo cột, tìm kiếm, phân trang và inspector                                   | Có prototype với kiểu dữ liệu riêng                                                      |
| Giới hạn số đối tượng | Scatter lấy tối đa 1.500 dòng đầu, bar chart lấy 10 cột đầu; có thông báo giới hạn trên giao diện    | Có giới hạn hiển thị; không chứng minh hiệu năng dữ liệu lớn                             |
| Nhãn mẫu              | Dataset mặc định có nguồn “Dữ liệu mẫu”; UI có ghi prototype/mock/local và nhãn ngoại lệ mẫu         | Có công bố dữ liệu minh họa; chưa phải luồng dữ liệu thật từ engine                      |
| Báo cáo cá nhân       | Có file bàn giao                                                                                     | Chưa có bằng chứng đầy đủ cho tuyên bố hoàn thành                                        |

## 5. Lỗi và vấn đề cần sửa

### NGA-01 — P1: Scene chưa có đường chạy hợp lệ trong repo bàn giao

- Vị trí: `web/src/App.tsx`, `web/src/scene/Scene3D.tsx`, workspace `apps/web` và cấu hình dự án.
- Ứng dụng thật bắt đầu ở `apps/web/src/main.tsx`, vẫn import `./app/App`. Không có import tới prototype ở `web/src/`.
- [App prototype](https://github.com/baongocson/Dashboard_3D/blob/52f531c/web/src/App.tsx#L1) import `./Scene3D` và `./data`, trong khi hai file được đặt ở `./scene/Scene3D.tsx` và `./scene/data.ts`.
- Scene import `@react-three/drei`, nhưng dependency này không có trong package manifest/lockfile của nhánh.
- Khi kiểm tra trực tiếp prototype bằng TypeScript strict, có lỗi không tìm thấy các module trên, import ThreeEvent chưa dùng type-only và các lỗi có thể undefined.
- `npm run typecheck` mặc định không bao gồm `web/src/`, nên có thể đạt trong khi prototype vẫn lỗi. Build hiện tại cũng chỉ build app nền tảng cũ.
- Hướng sửa: đặt scene vào `apps/web/src/scene`, sửa import, thống nhất cách nối với Phát, xử lý dependency và toàn bộ lỗi strict theo cấu hình chung. Không tạo App thứ hai để thay thế luồng sản phẩm nếu chưa thống nhất tích hợp.
- Tiêu chí kiểm chứng: từ checkout sạch, cài dependencies bằng lockfile, typecheck/build bao gồm scene và mở app thực sự render được scene.

### NGA-02 — P2: Selection và dữ liệu chưa tuân theo contracts để chọn đúng ô/phiên bản

- Vị trí: [ChartProps và handlers trong Scene3D.tsx](https://github.com/baongocson/Dashboard_3D/blob/52f531c/web/src/scene/Scene3D.tsx#L19), `web/src/scene/data.ts` và App prototype.
- Callback scatter chỉ trả rowId; callback bar chỉ trả tên cột. Không có selection đầy đủ versionId/rowId/columnId để Phát xác định một ô Missing.
- Dữ liệu dùng DataSet/DataRow riêng: cột là string names, missing là chuỗi rỗng, không dùng Dataset/contracts chung. Một dòng có nhiều ô thiếu không thể xác định ô đích chỉ bằng rowId.
- Không có chart source version/current version props hoặc guard read-only cho chart cũ. CSV prototype cũng gán mọi lần import versionId cố định `import-v1`.
- Hướng sửa: thống nhất adapter Dataset/chart result và callback selection với Phát/Nguyên; dùng stable column IDs và version ID thật. Chart cũ phải có nguồn phiên bản rõ, chỉ xem khi không thuộc current version.
- Đây là khoảng trống triển khai theo phân công; chưa có luồng Apply thật để tái hiện chỉnh sửa nhầm phiên bản đầu cuối.

### NGA-03 — P1: Parser CSV riêng làm mất hoặc tự sửa dữ liệu không hợp lệ

- Vị trí: [parseCsv trong data.ts](https://github.com/baongocson/Dashboard_3D/blob/52f531c/web/src/scene/data.ts#L47).
- Đã chạy trực tiếp các hàm từ nhánh:

| Input              | Actual                                     | Expected theo baseline                 |
| ------------------ | ------------------------------------------ | -------------------------------------- |
| `a,b\n1,2,KEEP-ME` | Trường KEEP-ME bị bỏ, không báo lỗi số cột | Chặn import và chỉ rõ bản ghi/dòng sai |
| `a,b\n1`           | Tự thêm trường b thành chuỗi rỗng          | Chặn sai số cột, không sửa ngầm        |
| `a,b\n1,2\n,`      | Dòng có hai ô thiếu bị bỏ                  | Giữ dòng có trường nhưng mọi ô thiếu   |

- App prototype đọc bằng file.text và parse/tính thống kê trên luồng giao diện; giới hạn riêng 8 MiB cũng khác baseline 20.000.000 byte.
- Hướng sửa: phối hợp Nguyên dùng pipeline CSV/Worker chung đã review; scene nhận kết quả hợp lệ để hiển thị. Không bàn giao parser minh họa này như parser sản phẩm.

### NGA-04 — P2: Missing bị tính thành số 0 khi xác định range của trục

- Vị trí: [derivePoints, bước tính ranges](https://github.com/baongocson/Dashboard_3D/blob/52f531c/web/src/scene/data.ts#L108).
- Dataset thử có giá trị trục X là chuỗi rỗng, `10`, `20`; trục Y/Z hợp lệ.
- Actual: Number của chuỗi rỗng là 0 và được đưa vào min/max. Điểm 10 có tọa độ X bằng 0, điểm 20 bằng 3.5; missing cũng bị đặt về X=0.
- Expected: range số chỉ tính từ giá trị hợp lệ 10–20; với công thức chuẩn hóa hiện có, 10 phải nằm ở -3.5 và 20 ở 3.5. Missing cần cách biểu diễn rõ, không làm sai range của dữ liệu hợp lệ.
- Hướng sửa: dùng metadata/type/missing từ engine, loại missing trước chuyển số và tính range; thống nhất cách biểu diễn missing để người dùng không hiểu nhầm là số đo thật.

### NGA-05 — P2: Dataset nhiều dòng làm lỗi stack dù scene chỉ lấy 1.500 điểm

- Vị trí: `derivePoints`, lệnh `Math.min(...values)` và `Math.max(...values)`.
- Cách tái hiện: gọi derivePoints với 200.000 dòng số hợp lệ và ba trục hợp lệ.
- Actual trong Node: RangeError với thông báo `Maximum call stack size exceeded`.
- Nguyên nhân: spread toàn bộ cột thành đối số hàm trước bước slice 1.500 điểm.
- Hướng sửa: tính min/max bằng vòng lặp hoặc dùng range do engine cung cấp; xử lý dữ liệu lớn ngoài render/luồng UI. Kiểm tra hiệu năng và số liệu hiển thị riêng với thống kê toàn bộ dữ liệu.
- Giới hạn: đây là tái hiện hàm dữ liệu, chưa phải benchmark WebGL hoặc kiểm thử CSV gần 20 MB trên browser.

### NGA-06 — P2: Bộ test mới chưa kiểm chứng được scene và không tích hợp đúng test runner

- Vị trí: [tests/e2e/structure.test.mjs](https://github.com/baongocson/Dashboard_3D/blob/52f531c/tests/e2e/structure.test.mjs#L1).
- Test dùng node:test và đọc source bằng regex, không có thao tác browser/WebGL.
- Root được tính thành thư mục tests, nên tìm `tests/package.json`, `tests/src/App.tsx`, `tests/src/Scene3D.tsx` và `tests/src/data.ts`; các đường dẫn này không tồn tại.
- Chạy `node --test tests/e2e/structure.test.mjs`: cả 5 tests fail vì ENOENT.
- Chạy `npm run test:e2e`: log có 5 ca Node test lỗi, nhưng command vẫn exit 0 và Playwright báo 2 smoke tests nền tảng đạt. Vì vậy kết quả exit 0 không chứng minh tests mới đã đạt.
- `npm run check` dừng ở 6 lỗi lint: 3 lỗi URL/no-undef trong test và 3 lỗi parser project không bao gồm các file TypeScript ở web/src.
- Hướng sửa: chuyển các ca tương tác sang Playwright đúng runner; dùng kiểm thử chọn điểm/ô, selection, camera và chart cũ. Nếu giữ test cấu trúc riêng, sửa đường dẫn, cấu hình runner và bảo đảm lỗi được phản ánh vào lệnh kiểm tra chính.

## 6. Đối chiếu nhiệm vụ phân công

| Yêu cầu                                        | Trạng thái                          | Phần cần hoàn thiện                                                           |
| ---------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| Scene R3F/Three với camera/zoom                | Có mã prototype                     | Chưa chạy được từ app/entrypoint repo đã bàn giao; cần sửa NGA-01             |
| Nhận Dataset/chart result theo giao diện chung | Chưa đạt                            | Đang dùng kiểu riêng, parser riêng và thống kê trong App                      |
| Chọn đúng ô và đồng bộ với Phát                | Một phần ý tưởng row selection      | Cần versionId/rowId/columnId và tích hợp vào bảng chung                       |
| Chart phiên bản cũ chỉ xem                     | Chưa triển khai                     | Chưa có nguồn version và guard read-only                                      |
| Không tự chạy lại chart sau Apply              | Chưa kiểm chứng                     | Chưa có Apply/chart lifecycle; hiện points được tính lại khi dataset/trục đổi |
| So sánh preview                                | Chưa triển khai                     | Chưa có props/kết quả preview hoặc UI so sánh                                 |
| Lưu/mở camera/config cùng phiên                | Chưa triển khai                     | OrbitControls chưa có giao diện lưu/restore camera/target/zoom                |
| Hiển thị giới hạn lấy mẫu, thống kê toàn bộ    | Có giới hạn/nhãn số điểm/cột tối đa | Cần dùng thống kê đúng từ engine và sửa range/dữ liệu lớn                     |
| E2E chọn điểm, selection, camera, chart cũ     | Chưa đạt                            | Test mới lỗi đường dẫn và chỉ kiểm tra source; chưa có E2E tương tác scene    |

Đăng nhập không phải đầu ra chính trong nhiệm vụ frontend 3D của Nga. Nghiệm thu phần này cần tập trung vào scene, selection, version, preview, camera và tích hợp; backend/auth do thành viên khác phụ trách.

## 7. Kết quả kiểm tra đã chạy

| Kiểm tra                                         | Kết quả                                                        | Giới hạn                                                             |
| ------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Typecheck mặc định                               | Đạt                                                            | Không bao gồm prototype web/src                                      |
| npm run check                                    | Không đạt                                                      | Dừng tại 6 lỗi lint                                                  |
| TypeScript strict trực tiếp cho 3 file prototype | Không đạt                                                      | Sai import, thiếu drei, type-only import và các lỗi có thể undefined |
| npm test chạy riêng                              | 16/16 tests nền tảng đạt                                       | Không kiểm tra code 3D mới                                           |
| Build web/API chạy riêng                         | Đạt                                                            | Build app cũ, không bundle scene của Nga                             |
| Node structure tests chạy riêng                  | 0/5 đạt                                                        | Sai đường dẫn file                                                   |
| npm run test:e2e                                 | Exit 0, 2 smoke Playwright đạt; đồng thời log 5 Node tests lỗi | Chưa chứng minh scene 3D hoạt động                                   |
| Parser sai số cột/dòng all-missing               | Không đạt                                                      | Đã tái hiện NGA-03                                                   |
| Range có missing                                 | Không đạt                                                      | Đã tái hiện NGA-04                                                   |
| derivePoints với 200.000 dòng                    | Không đạt                                                      | Đã tái hiện NGA-05                                                   |
| Xoay/zoom/click scene trên Chrome thật           | Chưa xác minh                                                  | Checkout bàn giao chưa có đường chạy scene hợp lệ                    |

Không dùng build/tests nền tảng đạt làm bằng chứng scene đã chạy; không kết luận hiệu năng, lưu/restore camera hoặc luồng Missing/Apply đã đạt.

## 8. Đối chiếu báo cáo cá nhân

Báo cáo `docs/teamwork/nga_bao_cao.md` ghi “Hoàn thành các nhiệm vụ được phân công” và “chạy thử dự án thành công trên môi trường local”, nhưng chưa kèm lệnh, môi trường, expected/actual hoặc commit chạy thử.

Thông tin bàn giao ghi thư mục chính `apps/web/src/scene/`, trong khi file đã push nằm tại `web/src/scene/`. Commit vẫn để placeholder. Cần sửa báo cáo để phản ánh đúng cây file và mức triển khai, phân biệt prototype trên máy cá nhân với checkout nhóm có thể clone/cài/chạy lại.

Đề nghị đổi trạng thái thành “Có prototype source, chưa tích hợp và chưa nghiệm thu frontend 3D”, cập nhật commit cùng danh sách lỗi/giới hạn. Mốc “Tối thứ Tư” cần bổ sung ngày và giờ cụ thể nếu tiếp tục dùng làm kế hoạch bàn giao.

## 9. Thứ tự hoàn thiện đề xuất

1. Sửa cấu trúc bàn giao và import/dependency/typecheck; phối hợp Phát nối một scene tối thiểu vào app chung.
2. Chốt Dataset/chart input và selection versionId/rowId/columnId theo contracts; bỏ parser riêng khỏi luồng sản phẩm.
3. Sửa mapping missing/range và lỗi dữ liệu lớn; dùng kết quả engine thay vì tự tính trong render.
4. Bổ sung chart source version và read-only cho chart cũ; thống nhất lúc nào người dùng yêu cầu chạy lại chart.
5. Tích hợp preview và lưu/khôi phục camera/config với Phát/Trâm.
6. Thay bộ test cấu trúc lỗi bằng tests đúng runner, có E2E chọn điểm/ô và selection, restore camera, chặn chỉnh sửa chart cũ.
7. Chạy lại từ checkout sạch, ghi môi trường/lệnh/kết quả và cập nhật báo cáo bàn giao trước review tiếp.

File `web/src/scene/1` chỉ là file tạm một dòng; cần kiểm tra và loại khỏi bàn giao nếu không có vai trò thực tế.

**Trạng thái đánh giá: Có prototype source 3D; chưa tích hợp chạy được trong repo chung, còn lỗi bàn giao/dữ liệu/tests và chưa hoàn thành nhiệm vụ được giao.**
