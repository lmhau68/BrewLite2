# ADR-003: PostgreSQL, migration và seed bằng công cụ của ORM

| Trạng thái | Ngày | Người đề xuất |
|---|---|---|
| Accepted (ORM: **đề xuất, cần Backend xác nhận**) | 05/11/2026 | Nhóm phát triển |

## Bối cảnh
PostgreSQL là bắt buộc. Cần schema tái tạo được từ DB rỗng, seed không nhân đôi dữ liệu (NFR-06), transaction và ràng buộc để chống trừ kho sai, tạo đơn trùng, thanh toán trùng (FR-08, FR-10).

## Quyết định
- **PostgreSQL 16**, truy cập qua **TypeORM** (đề xuất; Prisma là phương án thay thế tương đương).
- **Migration** là file có thứ tự trong `apps/api/migrations/`, không dùng `synchronize` ở production.
- **Seed** là script idempotent trong `apps/api/seed/` (upsert theo khóa tự nhiên).
- Ràng buộc DB: `UNIQUE` cho khóa idempotency, `CHECK (stock_quantity >= 0)`, khóa ngoại đầy đủ.
- Tiền lưu **số nguyên VND**.
- Tạo đơn + trừ kho trong một transaction, khóa dòng sản phẩm khi trừ.
- Production: migration chạy ở **bước riêng trước khi bật phiên bản mới**, ưu tiên thay đổi tương thích ngược.

## Lý do
- Quan hệ rõ (User–Order–OrderItem–Payment), cần ACID.
- Migration có phiên bản giúp tái tạo môi trường và rollback ứng dụng an toàn hơn.

## Hạn chế và đánh đổi
- Migration phá vỡ tương thích (xóa/đổi cột) không rollback dữ liệu tự động → dùng kiểu expand/contract, nêu giới hạn trong hướng dẫn rollback (NFR-09).
- TypeORM cần cẩn thận với transaction và khóa; chấp nhận để bám hệ sinh thái NestJS.

## Phương án đã loại
- NoSQL: không phù hợp giao dịch và quan hệ.
- `synchronize: true`: dễ mất dữ liệu ở production.

## Hệ quả
Thành phần: COMP-DB. Yêu cầu: NFR-04, NFR-06, FR-08, FR-10.
