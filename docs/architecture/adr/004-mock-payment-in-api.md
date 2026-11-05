# ADR-004: Mock Payment là module trong COMP-API, không tách container

| Trạng thái | Ngày | Người đề xuất |
|---|---|---|
| Accepted | 05/11/2026 | Nhóm phát triển |

## Bối cảnh
Thanh toán Ví/Thẻ được mô phỏng (FR-09, FR-20 là Won't). `srs.md` mục 5 xác định đây là module/service nội bộ do nhóm tự mô phỏng. Sequence diagram có lifeline "Payment Service (Mock)". Cần thể hiện đúng trong Deployment diagram.

## Quyết định
Cài đặt Mock Payment (**COMP-PAY**) là **module trong NestJS API**, đứng sau interface `PaymentGateway`. Không tạo container hay dịch vụ riêng. Sequence diagram vẫn vẽ lifeline Payment Service vì đó là ranh giới logic.

Mock hỗ trợ kịch bản thành công, thất bại, chậm/timeout để kiểm thử BR-04 và FR-10.

## Lý do
- Giảm một thành phần vận hành và một lần deploy.
- Interface cho phép thay cổng thật sau này mà không đổi nghiệp vụ.
- Không xử lý dữ liệu thẻ thật (NFR-04).

## Hạn chế và đánh đổi
- Không phản ánh độ trễ/lỗi mạng thật giữa hai dịch vụ → mô phỏng thêm timeout bằng cấu hình.
- Nếu tách ra sau này cần thêm giao thức và bảo mật nội bộ.

## Phương án đã loại
- **Container riêng:** thêm công vận hành, không cần cho phạm vi bài tập.
- **Cổng thật (VNPay, MoMo, Stripe):** ngoài phạm vi (OS-01).

## Hệ quả cho Task 3.2
**Không vẽ node/container riêng cho Payment.** Thể hiện COMP-PAY là component bên trong node COMP-API.
