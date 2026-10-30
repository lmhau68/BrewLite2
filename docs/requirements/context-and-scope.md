# BrewLite – Bối cảnh, Stakeholder và Phạm vi (Task 1.1)

| Thông tin | Nội dung |
|---|---|
| Dự án | BrewLite – ứng dụng đặt đồ uống mobile-first/PWA |
| Môn học | Công nghệ Phần mềm – Đại học Sài Gòn |
| Công nghệ bắt buộc | Next.js, NestJS, PostgreSQL (kèm Docker) |
| Phiên bản tài liệu | 1.0 |
| Tệp | `docs/requirements/context-and-scope.md` |

---

## 1. Bối cảnh và vấn đề nghiệp vụ

### 1.1 Bối cảnh

Các quán cà phê/trà sữa quy mô nhỏ và vừa hiện nay chủ yếu nhận đơn trực tiếp tại quầy hoặc qua tin nhắn mạng xã hội. Cách làm này đơn giản nhưng ngày càng bộc lộ hạn chế khi lượng khách tăng, nhất là vào giờ cao điểm. Trong khi đó, các nền tảng giao đồ uống lớn thu phí hoa hồng cao và quán không sở hữu dữ liệu khách hàng của chính mình.

**BrewLite** là ứng dụng web mobile-first (PWA) cho phép khách hàng tự xem menu, tùy chỉnh đồ uống, đặt đơn, thanh toán và theo dõi trạng thái đơn ngay trên điện thoại. Phía cửa hàng, nhân viên quầy và quản lý nhận đơn và cập nhật trạng thái trên cùng một hệ thống.

### 1.2 Vấn đề cần giải quyết

| # | Vấn đề hiện tại | Hệ quả | BrewLite giải quyết bằng |
|---|---|---|---|
| P1 | Khách phải xếp hàng, chờ gọi món tại quầy | Mất thời gian, khách bỏ về giờ cao điểm | Đặt đơn từ xa, không cần xếp hàng |
| P2 | Ghi đơn thủ công hoặc qua tin nhắn | Nhầm món, nhầm size/topping, thất lạc đơn | Đơn hàng có cấu trúc, lưu trong cơ sở dữ liệu |
| P3 | Khách không biết đơn đang ở bước nào | Hỏi lại nhân viên, giảm trải nghiệm | Theo dõi trạng thái đơn theo thời gian thực |
| P4 | Menu giấy khó cập nhật, không biết món hết hàng | Khách gọi món đã hết, phát sinh khiếu nại | Menu số, tồn kho được kiểm tra khi đặt đơn |
| P5 | Thanh toán chủ yếu tiền mặt, đối soát thủ công | Sai sót, khó thống kê doanh thu | Thanh toán Ví/Thẻ (mô phỏng), ghi nhận giao dịch |
| P6 | Không lưu lịch sử khách hàng | Khó chăm sóc, khó khuyến mãi | Tài khoản, lịch sử đơn, khuyến mãi và tích điểm |

### 1.3 Mục tiêu của sản phẩm

1. Cho phép khách hoàn thành luồng **Xem menu → Chọn tùy chọn → Giỏ hàng → Đặt đơn → Thanh toán → Theo dõi đơn** trên điện thoại.
2. Giảm sai sót ghi đơn và thời gian chờ tại quầy.
3. Cung cấp cho cửa hàng công cụ quản lý trạng thái đơn và dữ liệu bán hàng cơ bản.
4. Đáp ứng yêu cầu học thuật: quy trình từ yêu cầu đến triển khai, có CI/CD và bản production truy cập được.

---

## 2. Stakeholder

### 2.1 Bảng stakeholder

| ID | Stakeholder | Vai trò / Mô tả | Mục tiêu | Kỳ vọng đối với hệ thống | Mức ảnh hưởng | Mức quan tâm |
|---|---|---|---|---|---|---|
| SH-01 | **Khách hàng** | Người dùng cuối đặt đồ uống qua điện thoại | Đặt món nhanh, đúng ý, biết khi nào nhận | Giao diện dễ dùng trên mobile, menu rõ ràng, chọn size/topping dễ, thanh toán an toàn, theo dõi được đơn, xem lại lịch sử | Cao | Cao |
| SH-02 | **Nhân viên quầy** | Nhận đơn, pha chế, giao món cho khách | Xử lý đơn chính xác, không bỏ sót | Thấy đơn mới ngay, thông tin món rõ (size, topping, ghi chú), cập nhật trạng thái nhanh, ít thao tác | Trung bình | Cao |
| SH-03 | **Quản lý cửa hàng** | Chủ quán/quản lý, chịu trách nhiệm vận hành và doanh thu | Tăng doanh thu, giảm sai sót, kiểm soát menu và khuyến mãi | Quản lý sản phẩm, giá, tồn kho; xem đơn và doanh thu; cấu hình khuyến mãi/tích điểm | Cao | Cao |
| SH-04 | **Giảng viên / khách hàng nghiệm thu** | Đánh giá sản phẩm và quy trình của nhóm | Kiểm tra sản phẩm đáp ứng đề bài và quy trình CNPM | Tài liệu đầy đủ, truy vết được, sản phẩm chạy được, có URL production, CI/CD hoạt động, lịch sử commit rõ ràng | Rất cao | Cao |
| SH-05 | **Nhóm phát triển** | Sinh viên thực hiện dự án | Hoàn thành đúng hạn, học và áp dụng quy trình, đạt điểm tốt | Yêu cầu rõ ràng, phạm vi khả thi, công cụ ổn định, phân công công việc hợp lý | Cao | Rất cao |
| SH-06 | **Đơn vị thanh toán** | Cổng/ví/ngân hàng xử lý giao dịch (mô phỏng trong MVP) | Giao dịch đúng, an toàn, không trùng lặp | Nhận yêu cầu thanh toán đúng định dạng, hỗ trợ idempotency, trả kết quả rõ ràng (thành công/thất bại), tuân thủ bảo mật | Trung bình | Thấp |

### 2.2 Ma trận ưu tiên stakeholder

| | Quan tâm thấp | Quan tâm cao |
|---|---|---|
| **Ảnh hưởng cao** | Giữ hài lòng: SH-04 (khi chưa nghiệm thu) | Quản lý chặt: SH-01, SH-03, SH-04, SH-05 |
| **Ảnh hưởng thấp** | Theo dõi: SH-06 | Thông tin thường xuyên: SH-02 |

### 2.3 Tóm tắt nhu cầu theo stakeholder

- **Khách hàng:** nhanh, dễ, chính xác, an toàn.
- **Nhân viên quầy:** đơn rõ ràng, cập nhật trạng thái đơn giản.
- **Quản lý:** kiểm soát menu, tồn kho, đơn hàng, khuyến mãi.
- **Giảng viên:** đủ tạo phẩm, truy vết được, triển khai thật.
- **Nhóm phát triển:** phạm vi vừa sức, kiểm soát được rủi ro.
- **Đơn vị thanh toán:** giao dịch hợp lệ, không trùng lặp.

---

## 3. Phạm vi

### 3.1 Trong phạm vi MVP (In-scope)

| ID | Nhóm chức năng | Nội dung |
|---|---|---|
| IS-01 | Menu | Xem danh sách sản phẩm theo danh mục; trạng thái loading, empty, error; dữ liệu mẫu (seed) |
| IS-02 | Chi tiết sản phẩm | Xem chi tiết; chọn size và topping; hiển thị giá theo lựa chọn |
| IS-03 | Giỏ hàng | Thêm, sửa số lượng, xóa món; tính tổng tiền |
| IS-04 | Xác thực | Đăng ký, đăng nhập, xác thực bằng JWT; yêu cầu đăng nhập khi đặt đơn |
| IS-05 | Đặt đơn | Tạo đơn từ giỏ hàng; kiểm tra tồn kho/hết hàng; tạo đơn và cập nhật tồn kho trong một transaction |
| IS-06 | Thanh toán | Thanh toán Ví/Thẻ **mô phỏng**; xử lý thành công/thất bại; idempotency khi gửi lại yêu cầu |
| IS-07 | Theo dõi đơn | Xác nhận đơn; xem trạng thái đơn; xem lịch sử đơn |
| IS-08 | Quản lý trạng thái đơn | Nhân viên/quản lý cập nhật trạng thái (ví dụ: Chờ thanh toán → Đã thanh toán → Đang pha chế → Sẵn sàng → Hoàn tất / Hủy) |
| IS-09 | Chất lượng | Validate dữ liệu ở frontend và backend; xử lý lỗi; bảo mật cơ bản (băm mật khẩu, JWT, không lộ secret) |
| IS-10 | Vận hành | Health endpoint `GET /health`; logging; migration/seed; docker-compose chạy local |
| IS-11 | CI/CD | CI (Install, Lint, Test, Build); CD (Build image, Push registry, Deploy, Smoke test, Rollback) |
| IS-12 | Tài liệu | SRS, use-case, sơ đồ, ADR, ma trận truy vết, README, release notes |

### 3.2 Phạm vi mở rộng (Extended – làm nếu đủ thời gian)

| ID | Nội dung | Ghi chú |
|---|---|---|
| EX-01 | Khuyến mãi (Promotion) | Mã giảm giá, áp dụng khi đặt đơn (có trong class diagram) |
| EX-02 | Tích điểm (Loyalty) | Cộng/trừ điểm theo đơn hàng (LoyaltyTransaction) |
| EX-03 | Trang quản trị cho quản lý | Quản lý sản phẩm, tồn kho, thống kê doanh thu cơ bản |
| EX-04 | PWA nâng cao | Cài đặt lên màn hình chính, cache offline cho menu |
| EX-05 | Thông báo trạng thái đơn | Cập nhật tự động (polling/WebSocket) hoặc thông báo đẩy |
| EX-06 | Đơn yêu thích / đặt lại | Đặt lại nhanh từ lịch sử đơn |

### 3.3 Ngoài phạm vi (Out-of-scope)

| ID | Nội dung không thực hiện | Lý do |
|---|---|---|
| OS-01 | Tích hợp cổng thanh toán thật (VNPay, MoMo, Stripe…) | Dùng dịch vụ thanh toán mô phỏng để tránh rủi ro pháp lý, tài chính và thời gian |
| OS-02 | Giao hàng tận nơi, theo dõi tài xế, bản đồ | Chỉ hỗ trợ nhận tại quầy trong MVP |
| OS-03 | Ứng dụng native (iOS/Android) | Dùng PWA thay thế |
| OS-04 | Hệ thống POS, in hóa đơn, kết nối máy in | Ngoài mục tiêu học phần |
| OS-05 | Quản lý nhiều chi nhánh/chuỗi cửa hàng | Giả định một cửa hàng |
| OS-06 | Quản lý kho nguyên liệu chi tiết, công thức pha chế | Chỉ quản lý tồn kho ở mức sản phẩm |
| OS-07 | Đa ngôn ngữ, đa tiền tệ | Chỉ tiếng Việt và VND |
| OS-08 | Đăng nhập qua mạng xã hội (Google, Facebook) | Chỉ email/mật khẩu |
| OS-09 | Quản lý nhân sự, chấm công, lương | Không liên quan luồng nghiệp vụ chính |
| OS-10 | Hoàn tiền tự động, đối soát với ngân hàng | Chỉ ghi nhận trạng thái thanh toán mô phỏng |

### 3.4 Luồng nghiệp vụ tối thiểu

```
Xem menu → Chọn tùy chọn → Giỏ hàng → Đặt đơn → Thanh toán → Theo dõi đơn
```

### 3.5 Ranh giới hệ thống

| Thuộc hệ thống BrewLite | Nằm ngoài hệ thống |
|---|---|
| Frontend Next.js (PWA), Backend NestJS, PostgreSQL, dịch vụ thanh toán mô phỏng, pipeline CI/CD | Thiết bị và trình duyệt của người dùng, nền tảng hosting, container registry, GitHub |

---

## 4. Giả định

| ID | Giả định | Ảnh hưởng nếu sai |
|---|---|---|
| A-01 | Hệ thống phục vụ **một cửa hàng** duy nhất | Cần thiết kế lại mô hình dữ liệu nếu nhiều chi nhánh |
| A-02 | Khách hàng nhận đồ uống **trực tiếp tại quầy**, không giao tận nơi | Phải bổ sung địa chỉ, phí giao hàng |
| A-03 | Thanh toán được **mô phỏng**; không xử lý dữ liệu thẻ thật | Phải tuân thủ PCI-DSS nếu dùng thẻ thật |
| A-04 | Khách hàng có điện thoại có trình duyệt hiện đại và kết nối Internet | Cần hỗ trợ offline hoặc trình duyệt cũ |
| A-05 | Khách phải **đăng nhập** mới được đặt đơn; xem menu không cần đăng nhập | Thay đổi luồng xác thực |
| A-06 | Tiền tệ là VND, ngôn ngữ giao diện là tiếng Việt | Cần i18n |
| A-07 | Dữ liệu menu ban đầu do nhóm tạo bằng seed; quản lý có thể cập nhật sau | Cần công cụ nhập liệu |
| A-08 | Nhân viên/quản lý có tài khoản được cấp sẵn (seed), không tự đăng ký | Cần quy trình cấp quyền |
| A-09 | Mỗi đơn hàng thuộc một khách hàng và gồm một hoặc nhiều món | Ảnh hưởng mô hình Order/OrderItem |
| A-10 | Nền tảng hosting miễn phí/giá rẻ đủ dùng cho demo và nghiệm thu | Cần phương án dự phòng (VPS) |
| A-11 | Giảng viên truy cập được repository và URL production tại thời điểm chấm | Mất điểm phần triển khai |

---

## 5. Ràng buộc

### 5.1 Ràng buộc kỹ thuật

| ID | Ràng buộc |
|---|---|
| C-01 | Frontend bắt buộc dùng **Next.js**, theo hướng mobile-first/PWA |
| C-02 | Backend bắt buộc dùng **NestJS**, tổ chức theo module/domain |
| C-03 | Cơ sở dữ liệu bắt buộc dùng **PostgreSQL**, có cơ chế migration |
| C-04 | Đóng gói và chạy local bằng **Docker** (`docker-compose.yml` chạy web, API, database) |
| C-05 | Có health endpoint (`GET /health`) |
| C-06 | Secret không được xuất hiện trong repository hoặc log CI |
| C-07 | Database production không public trực tiếp ra Internet |
| C-08 | Production phải truy cập được qua **HTTPS** |
| C-09 | Có thể bổ sung công nghệ khác nhưng không được thay thế 3 thành phần bắt buộc |

### 5.2 Ràng buộc quy trình và tổ chức

| ID | Ràng buộc |
|---|---|
| C-10 | Năm task phải hoàn thành **tuần tự**; task sau chỉ được nghiệm thu khi tạo phẩm task trước đã có trên repository |
| C-11 | Mọi thay đổi yêu cầu, sơ đồ, kiến trúc phải đi qua commit/pull request và ghi rõ lý do |
| C-12 | Pull request không được merge nếu lint, test hoặc build thất bại |
| C-13 | Phải có ma trận truy vết `docs/traceability-matrix.md` |
| C-14 | Phải có URL production hoạt động tại thời điểm chấm |
| C-15 | Cấu trúc repository theo quy định: `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows` |

### 5.3 Ràng buộc nguồn lực

| ID | Ràng buộc |
|---|---|
| C-16 | Thời gian giới hạn trong một học kỳ, chia hai Sprint |
| C-17 | Nhân lực là sinh viên, kinh nghiệm hạn chế với NestJS/CI-CD |
| C-18 | Ngân sách gần như bằng 0: dùng gói miễn phí của hosting và registry |

---

## 6. Rủi ro ban đầu

Thang điểm: Xác suất (X) và Tác động (T) từ 1 (thấp) đến 3 (cao); Điểm = X × T.

| ID | Rủi ro | X | T | Điểm | Biện pháp giảm thiểu | Người phụ trách |
|---|---|---|---|---|---|---|
| R-01 | Phạm vi quá lớn so với thời gian, không kịp hoàn thành | 3 | 3 | 9 | Ưu tiên MoSCoW; chỉ cam kết Must trong MVP; đưa Promotion/Loyalty vào mở rộng | Cả nhóm |
| R-02 | Thành viên thiếu kinh nghiệm NestJS/Next.js/Docker/CI-CD | 3 | 2 | 6 | Học sớm, làm spike ở Sprint 1, pair programming, tài liệu hướng dẫn | Cả nhóm |
| R-03 | Xung đột mã nguồn, mất đồng bộ khi làm nhóm | 2 | 2 | 4 | Quy ước branch/PR, review bắt buộc, commit nhỏ và thường xuyên | Trưởng nhóm |
| R-04 | Tài liệu và sơ đồ mâu thuẫn với nhau hoặc với code | 2 | 3 | 6 | Ma trận truy vết, review chéo, thay đổi qua PR có lý do | Phụ trách tài liệu |
| R-05 | Lỗi giao dịch: oversell tồn kho, tạo đơn trùng, thanh toán 2 lần | 2 | 3 | 6 | Transaction DB, khóa/ràng buộc tồn kho, idempotency key, integration test | Backend |
| R-06 | Nền tảng hosting miễn phí giới hạn tài nguyên, ngủ đông, hoặc đổi chính sách | 2 | 3 | 6 | Chọn nền tảng sớm, thử deploy từ Sprint 1, có phương án dự phòng (VPS) | DevOps |
| R-07 | Pipeline CI/CD lỗi ở phút cuối, deploy thất bại | 2 | 3 | 6 | Xây CI từ Sprint 1; có smoke test và quy trình rollback; deploy thử sớm | DevOps |
| R-08 | Lộ secret (JWT secret, DB password) trong repository hoặc log | 2 | 3 | 6 | `.env.example`, GitHub Secrets, quét secret, không log biến môi trường | DevOps |
| R-09 | Yêu cầu thay đổi hoặc hiểu sai yêu cầu của giảng viên | 2 | 2 | 4 | Chốt phạm vi sớm, xác nhận với giảng viên, ghi nhận thay đổi qua PR | Trưởng nhóm |
| R-10 | Giao diện khó dùng trên mobile, hiệu năng kém | 2 | 2 | 4 | Thiết kế mobile-first, test trên thiết bị thật, đo Lighthouse | Frontend |
| R-11 | Thành viên vắng mặt hoặc không đóng góp đều | 2 | 3 | 6 | Phân công rõ trên issue board, họp ngắn hằng tuần, theo dõi lịch sử commit | Trưởng nhóm |
| R-12 | Dịch vụ thanh toán mô phỏng không phản ánh đủ hành vi thật (timeout, trùng lặp) | 2 | 2 | 4 | Mô phỏng cả các nhánh thất bại và gửi lại yêu cầu | Backend |
