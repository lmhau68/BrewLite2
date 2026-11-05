# ADR-002: Backend theo modular monolith phân lớp; frontend tách riêng

| Trạng thái | Ngày | Người đề xuất |
|---|---|---|
| Accepted | 05/11/2026 | Nhóm phát triển |

## Bối cảnh
Cần backend xử lý nghiệp vụ đặt đơn, thanh toán, tồn kho với yêu cầu nhất quán dữ liệu (FR-08, FR-10) trong thời gian một học kỳ, nhóm sinh viên chưa nhiều kinh nghiệm NestJS/CI-CD (rủi ro R-02). Công nghệ bắt buộc: Next.js, NestJS, PostgreSQL.

## Quyết định
- **Backend:** một ứng dụng NestJS (COMP-API), chia **module theo domain** (`auth`, `products`, `orders`, `payments`, `health`, `common`) và **phân lớp** Controller → Service → Repository.
- **Frontend:** Next.js (COMP-WEB) là ứng dụng riêng, giao tiếp với API qua REST/JSON + JWT.
- Trình bày theo C4 (mức 1–3) trong `architecture.md`.

## Lý do (ưu điểm)
- Một DB và một tiến trình cho phép **transaction ACID** khi tạo đơn và trừ kho.
- Ít thành phần vận hành: một container API, một DB.
- Ranh giới module rõ, phân công theo domain, dễ viết unit/integration test.
- Có thể tách module thành dịch vụ riêng về sau.

## Hạn chế và đánh đổi
- Scale và triển khai cả khối; lỗi nặng ảnh hưởng toàn API. Chấp nhận vì tải demo nhỏ.
- Cần kỷ luật phụ thuộc giữa module (review PR kiểm tra).

## Phương án đã loại
| Phương án | Lý do loại |
|---|---|
| Vi dịch vụ | Quá phức tạp cho phạm vi và nhân lực; transaction phân tán khó (FR-08) |
| Next.js full-stack (API Routes thay NestJS) | Vi phạm yêu cầu bắt buộc dùng NestJS |
| Serverless | Cold start, khó giữ transaction và kết nối DB, lệch yêu cầu Docker |

## Hệ quả
Thành phần: COMP-WEB, COMP-API. Yêu cầu: FR-08, NFR-01, NFR-07.
