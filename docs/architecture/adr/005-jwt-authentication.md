# ADR-005: Xác thực bằng JWT ngắn hạn, mật khẩu bcrypt, phân quyền theo vai trò

| Trạng thái | Ngày | Người đề xuất |
|---|---|---|
| Accepted | 05/11/2026 | Nhóm phát triển |

## Bối cảnh
Cần đăng ký/đăng nhập (FR-05, FR-06), phân quyền CUSTOMER/STAFF/MANAGER (FR-13), chống dò mật khẩu (NFR-03). Đề bài nêu JWT.

## Quyết định
- JWT truy cập, **hết hạn tối đa 60 phút**, ký bằng `JWT_SECRET` (biến môi trường).
- Mật khẩu băm **bcrypt** có salt; độ dài 8 đến 72 byte UTF-8.
- `JwtAuthGuard` + `RolesGuard`; API tự kiểm tra quyền sở hữu đơn.
- Đăng ký công khai chỉ tạo CUSTOMER, bỏ qua trường `role`; STAFF/MANAGER do seed cấp.
- `Throttler`: 5 lần sai / 60 giây / cặp email-IP → HTTP 429.
- Client giữ token ở phía trình duyệt; đăng xuất xóa phiên phía client.

## Lý do
Không cần lưu phiên ở server, đơn giản, đủ cho MVP.

## Hạn chế và đánh đổi
- Không thu hồi token ngay trước khi hết hạn (không có refresh token/blacklist) → rút ngắn thời hạn.
- Lưu token ở trình duyệt có rủi ro XSS → validate/escape đầu vào, cân nhắc cookie `HttpOnly` nếu còn thời gian.

## Phương án đã loại
Session server-side (cần kho phiên); OAuth mạng xã hội (OS-08).

## Hệ quả
Thành phần: COMP-API (`auth`). Yêu cầu: FR-05, FR-06, FR-13, NFR-03. `JWT_SECRET` là secret.
