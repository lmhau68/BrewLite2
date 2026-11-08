# PROJECT CONTEXT & AI INSTRUCTIONS

## 1. Project Overview
Đây là dự án phát triển ứng dụng quản lý và hiển thị menu sản phẩm.

## 2. Architecture
- Tuân thủ Layered Architecture.
- Phân chia rõ Frontend và Backend.
- Không được tự ý thay đổi kiến trúc đã thống nhất ở Task 3.

## 3. Technology Stack
### Frontend
- Next.js
- TypeScript

### Backend
- NestJS
- TypeScript
- PostgreSQL
- ORM

## 4. Project Structure
- apps/web: Frontend application.
- apps/api: Backend application.

## 5. Development Rules
- Đọc và hiểu code hiện tại trước khi chỉnh sửa.
- Không tự ý thay đổi cấu trúc thư mục.
- Không tạo file trùng chức năng.
- Tuân thủ nguyên tắc Clean Code.
- Tái sử dụng code khi phù hợp.
- Không tự ý thêm thư viện nếu chưa thực sự cần thiết.

## 6. Current Task
- Khởi tạo dự án Next.js và NestJS.
- Cấu hình ORM kết nối PostgreSQL.
- Tạo dữ liệu mẫu (Seed).
- Xây dựng API GET /products.
- Xây dựng API GET /products/:id.
- Thiết kế giao diện Menu theo Mobile-first.
- Xử lý Loading, Empty và Error.
- Viết Unit Test cho Backend.

## 7. AI Behavior
Trước khi thực hiện bất kỳ yêu cầu nào:
1. Đọc file AGENTS.md.
2. Kiểm tra cấu trúc dự án hiện tại.
3. Xác định module liên quan đến yêu cầu.
4. Đảm bảo code mới không vi phạm kiến trúc.
5. Không tự ý triển khai ngoài phạm vi Task được giao.