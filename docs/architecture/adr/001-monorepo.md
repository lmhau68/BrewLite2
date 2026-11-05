# ADR-001: Dùng monorepo cho toàn bộ dự án

| Trạng thái | Ngày | Người đề xuất |
|---|---|---|
| Accepted | 05/11/2026 | Nhóm phát triển |

## Bối cảnh
Dự án gồm frontend, backend, tài liệu, test và workflow CI/CD. Đề bài yêu cầu một repository có cấu trúc `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`, và yêu cầu truy vết giữa yêu cầu, thiết kế, code, test.

## Quyết định
Dùng **một repository (monorepo)** với cấu trúc:
```
apps/web   apps/api   docs   tests   .github/workflows   docker-compose.yml   .env.example
```
Không dùng công cụ monorepo phức tạp (Nx, Turborepo); mỗi app có `package.json` riêng.

## Lý do (ưu điểm)
- Tài liệu, code và test cùng một commit/PR nên dễ truy vết và đồng bộ.
- Một CI, một lịch sử thay đổi cho giảng viên chấm.
- Đúng cấu trúc đề bài; người ngoài nhóm chỉ cần clone một repo.

## Hạn chế và đánh đổi
- CI chạy cả repo, có thể chậm khi lớn → dùng `paths` filter trong workflow.
- Hai app dùng chung repo nhưng độc lập phiên bản phụ thuộc → không dùng workspace chia sẻ code ở MVP.

## Phương án đã loại
- **Hai repo riêng (web, api):** khó truy vết, khó đồng bộ tài liệu, tăng công quản trị cho nhóm nhỏ.

## Hệ quả
Task 4.1 tạo đúng cấu trúc trên. Thành phần liên quan: COMP-WEB, COMP-API, COMP-CI.
