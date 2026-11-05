# ADR-007: Logging JSON, health endpoint `GET /health`, cấu hình bằng biến môi trường

| Trạng thái | Ngày | Người đề xuất |
|---|---|---|
| Accepted | 05/11/2026 | Nhóm phát triển |

## Bối cảnh
NFR-08 yêu cầu log có thời gian, mức, mã tương quan, truy được theo mã đơn/giao dịch, che dữ liệu nhạy cảm. NFR-02 và NFR-09 yêu cầu health check và smoke test. NFR-04/06 yêu cầu secret không nằm trong repo và có file cấu hình mẫu.

## Quyết định
- **Logging:** log JSON ra stdout (`nestjs-pino` hoặc tương đương) với `timestamp`, `level`, `requestId`, và `orderCode`/`transactionId` ở sự kiện đơn/thanh toán/đổi trạng thái. Che `password`, `authorization`, dữ liệu thẻ. Nền tảng thu log từ stdout.
- **Health:** `GET /health` kiểm tra DB bằng `SELECT 1`; **200** nếu sẵn sàng, **503** nếu mất DB; không trả secret.
- **Cấu hình:** biến môi trường, đọc bằng `ConfigModule`, **validate khi khởi động**; `.env.example` chỉ có placeholder; secret ở secret store.

## Lý do
Chuẩn 12-factor; stdout phù hợp mọi nền tảng container; health dùng chung cho nền tảng và CD.

## Hạn chế và đánh đổi
- Chưa có tập trung log/metrics/alert (ngoài phạm vi); chỉ dựa vào log của nền tảng.
- `NEXT_PUBLIC_*` lộ ra trình duyệt, tuyệt đối không đặt secret.

## Hệ quả
Thành phần: COMP-API (`common`, `health`). Yêu cầu: NFR-02, NFR-04, NFR-08, NFR-09. Deployment diagram cần thể hiện: biến môi trường/secret, health check, luồng log.
