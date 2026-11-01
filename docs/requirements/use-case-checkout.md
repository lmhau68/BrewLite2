# Đặc tả use-case: Đặt đơn và thanh toán

> Tài liệu này đặc tả UC-06 và UC-07 theo hai biểu mẫu riêng. UC-06 luôn gọi UC-07 qua quan hệ `<<include>>`; sơ đồ và đặc tả chi tiết UC-07 ở bên dưới.

## UC-06 – Đặt đơn

- **Actor chính:** Khách hàng
- **Actor phụ:** Không có
- **Mục tiêu:** Tạo đơn từ giỏ hàng hợp lệ và chuyển đơn sang thanh toán.
- **Kích hoạt:** Khách hàng chọn “Đặt hàng” từ giỏ hàng.
- **Điều kiện trước:**
  1. Khách hàng đã đăng nhập.
  2. Giỏ hàng có ít nhất một món.
- **Điều kiện sau:**
  - **Thành công:** Đơn cùng các dòng món được lưu, tồn kho được trừ nhất quán, đơn có trạng thái `PENDING`; hệ thống kích hoạt UC-07 để thanh toán.
  - **Thất bại:** Không tạo đơn dở dang và không trừ tồn kho một phần; khách hàng được thông báo lỗi.
- **Luồng chính:**
  1. Khách hàng mở giỏ hàng và chọn “Đặt hàng”.
  2. Hệ thống kiểm tra sản phẩm, tùy chọn, giá và tồn kho hiện tại; giá được tính từ dữ liệu phía máy chủ.
  3. Hệ thống tạo đơn cùng các dòng món và trừ tồn kho trong cùng một giao dịch; đơn có trạng thái `PENDING`.
  4. Hệ thống hiển thị mã đơn, các món và tổng tiền.
  5. Hệ thống kích hoạt UC-07 (Thanh toán mô phỏng) thông qua quan hệ `<<include>>`.
- **Luồng thay thế / ngoại lệ E1 – Giá, tùy chọn hoặc tồn kho không hợp lệ:**
  1. Tại bước 2, hệ thống phát hiện giá/tùy chọn đã thay đổi hoặc món không đủ tồn kho.
  2. Hệ thống từ chối tạo đơn, không trừ tồn kho một phần và thông báo cho khách hàng.
- **Liên kết yêu cầu:** FR-07, FR-08; BR-01, BR-02, BR-05.

## UC-07 – Thanh toán mô phỏng

- **Actor chính:** Khách hàng
- **Actor phụ:** Dịch vụ thanh toán (Mock), trả kết quả thanh toán mô phỏng. Actor này thể hiện dịch vụ bên ngoài trong mô hình use-case; mã nguồn hiện tại mô phỏng kết quả thanh toán ở backend.
- **Mục tiêu:** Ghi nhận thanh toán Ví hoặc Thẻ mô phỏng cho đơn hàng.
- **Kích hoạt:** UC-06 gọi UC-07 sau khi tạo đơn; khách hàng chọn Ví hoặc Thẻ mô phỏng.
- **Điều kiện trước:**
  1. Khách hàng đã đăng nhập và là chủ đơn.
  2. Đơn hàng ở trạng thái `PENDING` khi bắt đầu thanh toán.
- **Điều kiện sau:**
  - **Thành công:** Giao dịch được ghi nhận; đơn chuyển sang `PAID`; giỏ hàng được cập nhật đúng một lần.
  - **Thất bại xác định:** Đơn chuyển sang `PAYMENT_FAILED`; giỏ hàng được giữ nguyên và khách hàng có thể thử lại trên cùng đơn bằng khóa thanh toán mới.
  - **Chưa xác định:** Hệ thống giữ kết quả ở trạng thái chưa xác định và tra cứu giao dịch trước khi cho thử lại.
- **Luồng chính:**
  1. Khách hàng chọn Ví hoặc Thẻ mô phỏng cho đơn `PENDING`.
  2. Hệ thống gửi yêu cầu thanh toán với khóa chống xử lý trùng.
  3. Dịch vụ thanh toán mô phỏng trả về kết quả thành công.
  4. Hệ thống ghi nhận giao dịch thành công và chuyển đơn sang `PAID`.
  5. Hệ thống cập nhật giỏ hàng đúng một lần, giữ lại các món được thêm sau khi tạo đơn.
  6. Hệ thống hiển thị kết quả thanh toán cho khách hàng.
- **Luồng thay thế A1 – Thanh toán thất bại xác định:**
  1. Tại bước 3, dịch vụ trả về kết quả thất bại.
  2. Hệ thống chuyển đơn sang `PAYMENT_FAILED`, giữ nguyên giỏ hàng và thông báo lỗi.
  3. Khi khách hàng thử lại, hệ thống dùng khóa mới trên cùng đơn; không tạo đơn mới hoặc trừ tồn kho lần nữa.
- **Luồng thay thế A2 – Chưa xác định được kết quả (ví dụ timeout):**
  1. Tại bước 3, hệ thống không nhận được kết quả rõ ràng.
  2. Hệ thống thông báo kết quả chưa xác định và tra cứu giao dịch hiện có trước khi cho thử lại.
  3. Nếu giao dịch thành công, hệ thống xử lý như bước 4–6; nếu thất bại, xử lý theo A1.
- **Tiêu chí chấp nhận:**
  1. Thanh toán thành công chuyển đơn từ `PENDING` sang `PAID` và cập nhật giỏ hàng đúng một lần.
  2. Thất bại xác định chuyển đơn sang `PAYMENT_FAILED`, giữ giỏ hàng và cho phép thử lại trên cùng đơn bằng khóa mới.
  3. Timeout không được báo nhầm là thành công hoặc thất bại; hệ thống tra cứu giao dịch trước khi thử lại.
  4. Gửi lại cùng khóa không tạo thêm giao dịch thành công; đơn `PAID` không được thanh toán thành công lần nữa.
- **Liên kết yêu cầu:** FR-09, FR-10; BR-03, BR-04.

## Sơ đồ use-case

![Sơ đồ use-case đặt đơn và thanh toán](../diagrams/use-case-checkout.svg)

[PlantUML source](../diagrams/use-case-checkout.puml)

## Truy vết liên quan

- **Use-case SRS:** UC-05 Đăng nhập/đăng xuất; UC-06 Đặt đơn; UC-07 Thanh toán mô phỏng; UC-08 Xem xác nhận và theo dõi đơn.
- **Yêu cầu chức năng:** FR-06 (đăng nhập và JWT), FR-07 (tạo đơn, kiểm tra giá/tồn kho), FR-08 (tính nhất quán đơn và tồn kho), FR-09 (thanh toán mô phỏng), FR-10 (chống thanh toán trùng), FR-11 (xác nhận và theo dõi đơn).
- **Quy tắc nghiệp vụ:** BR-01 (tính giá), BR-02 (tồn kho), BR-03 (hủy đơn đồng thời với thanh toán), BR-04 (timeout và tra cứu giao dịch), BR-05 (chống tạo đơn trùng).
