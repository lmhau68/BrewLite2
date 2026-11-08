# BrewLite

Ứng dụng đặt đồ uống cho cửa hàng BrewLite. Luồng nghiệp vụ:
**Xem menu → Chọn tùy chọn → Giỏ hàng → Đặt đơn → Thanh toán → Theo dõi đơn**.

> **Trạng thái hiện tại — Sprint 2 (Task 5.1).** Ứng dụng có luồng từ xem menu,
> chọn size/topping, giỏ hàng, đăng nhập, đặt đơn đến thanh toán mô phỏng và
> theo dõi/cập nhật trạng thái đơn.

## Công nghệ

| Thành phần | Công nghệ | Thư mục |
|---|---|---|
| Frontend | Next.js 16 (App Router), TypeScript | `apps/web` |
| Backend | NestJS 12, TypeORM 0.3 | `apps/api` |
| Cơ sở dữ liệu | PostgreSQL 16 | `apps/api/migrations`, `apps/api/seed` |
| Đóng gói | Docker, Docker Compose | `Dockerfile`, `docker-compose.yml` |

Kiến trúc chi tiết: [`docs/architecture/architecture.md`](docs/architecture/architecture.md).
Yêu cầu chức năng/phi chức năng: [`docs/requirements/srs.md`](docs/requirements/srs.md).

## Chạy bằng Docker Compose (khuyến nghị)

Yêu cầu: Docker và Docker Compose.

```bash
cp .env.example .env
docker compose up -d --build
```

Sau đó truy cập:

| Dịch vụ | URL |
|---|---|
| Frontend (menu) | http://localhost:3000 |
| API | http://localhost:3001 |
| Health check | http://localhost:3001/health |

Trước khi khởi động, thay `JWT_SECRET` trong `.env` bằng một chuỗi ngẫu nhiên
riêng tư dài tối thiểu 32 ký tự. `MOCK_PAYMENT_OUTCOME` nhận `SUCCESS`,
`FAILED` hoặc `TIMEOUT` để thử các kết quả thanh toán giả lập. Thanh toán ngân
hàng/QR chỉ phục vụ demo; không kết nối ngân hàng và không xử lý tiền thật.

Migration và seed được chạy tự động trước khi container `api` khởi động.
Để dùng màn hình nhân viên trong demo, điền `SEED_STAFF_EMAIL` và
`SEED_STAFF_PASSWORD` trong `.env` trước lần chạy đầu. Seed tạo tài khoản
`STAFF` mà không dùng mật khẩu mặc định; đặt các biến này trước khi áp dụng
migration/seed trên môi trường mới.
Kiểm tra dữ liệu mẫu:

```bash
curl http://localhost:3001/products
```

Dừng và xoá container (giữ dữ liệu trong volume `pgdata`):

```bash
docker compose down
# Xoá cả dữ liệu:
docker compose down -v
```

## Chạy local không dùng Docker

Cần Node.js 20+ và PostgreSQL 16 đang chạy.

```bash
# 1. Backend
cd apps/api
npm install
cp ../../.env.example .env          # DATABASE_URL phải trỏ tới localhost nếu chạy ngoài Compose
# đặt JWT_SECRET riêng tư; tùy chọn đặt SEED_STAFF_EMAIL/SEED_STAFF_PASSWORD
npm run migration:run               # tạo schema
npm run seed                        # nạp dữ liệu mẫu (idempotent)
npm run start:dev                   # http://localhost:3001

# 2. Frontend (terminal khác)
cd apps/web
npm install
npm run dev                         # http://localhost:3000
```

## Script có sẵn

Chạy từ thư mục `apps/api`:

| Script | Mô tả |
|---|---|
| `npm run start:dev` | Chạy API ở chế độ watch |
| `npm run build` | Build ra `dist/` |
| `npm run migration:run` | Chạy migration (tạo schema từ DB rỗng) |
| `npm run seed` | Nạp dữ liệu mẫu, idempotent |
| `npm run lint` | Chạy oxlint |
| `npm test` | Chạy unit test |
| `npm run test:cov` | Unit test kèm coverage |

Chạy từ thư mục `apps/web`:

| Script | Mô tả |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Build production |
| `npm start` | Chạy production build |

## API

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/products` | Danh sách món. Query `category` lọc theo danh mục, `includeUnavailable=true` gồm món hết hàng. |
| GET | `/products/:id` | Chi tiết món kèm size và topping hỗ trợ. |
| GET | `/health` | Health check API + DB (200 sẵn sàng, 503 khi mất DB). |
| POST | `/auth/register`, `/auth/login` | Đăng ký khách hàng và đăng nhập, trả JWT. |
| GET | `/auth/me` | Tài khoản hiện tại (JWT). |
| POST / GET | `/orders` | Tạo đơn idempotent và liệt kê đơn của tài khoản (JWT). |
| GET | `/orders/:orderId` | Chi tiết đơn thuộc tài khoản (JWT). |
| POST / GET | `/payments` | Thanh toán mô phỏng / tra cứu giao dịch (JWT). |
| GET | `/staff/orders` | Danh sách đơn cho nhân viên/quản lý (JWT, phân quyền). |
| PATCH | `/staff/orders/:orderId/status` | Cập nhật trạng thái đơn hợp lệ (JWT, phân quyền). |

Giá trả về là **số nguyên VND** theo BR-01.

### Giao diện

| Route | Mô tả |
|---|---|
| `/` | Menu: danh sách món, lọc theo danh mục, ảnh minh hoạ từng món. |
| `/products/:id` | Chi tiết món: ảnh, mô tả, giá, **kích thước (S/M/L kèm phụ thu)** và **topping hỗ trợ** (FR-02). |
| `/cart` | Sửa giỏ hàng và tạo đơn. |
| `/login`, `/register` | Đăng nhập và đăng ký khách hàng. |
| `/checkout/payment/:orderId` | Thanh toán mô phỏng bằng QR ví hoặc ngân hàng/thẻ giả lập. |
| `/orders`, `/orders/:orderId` | Lịch sử, chi tiết và trạng thái đơn của khách. |
| `/staff/orders` | Nhân viên/quản lý xem đơn và cập nhật trạng thái. |

Ảnh món nằm ở `apps/web/public/images/menu/` và được ánh xạ qua trường
`imageUrl` của sản phẩm trong database.

## Cấu trúc thư mục

```
brewlite/
├── apps/
│   ├── api/                    # NestJS
│   │   ├── src/
│   │   │   ├── config/         # Cấu hình kết nối DB
│   │   │   ├── database/       # Entity, migration, seed
│   │   │   └── modules/        # products, health, auth, orders, payments
│   │   └── Dockerfile
│   └── web/                    # Next.js
│       ├── app/                # App Router (menu + /products/[id])
│       ├── components/         # Component giao diện menu
│       ├── public/images/menu/ # Ảnh từng món
│       ├── lib/                # API client, kiểu dữ liệu
│       └── Dockerfile
├── docs/                       # Yêu cầu, sơ đồ, kiến trúc
├── .github/workflows/          # CI/CD
├── docker-compose.yml
└── .env.example
```

## Quy ước

- Commit theo [Conventional Commits](CONTRIBUTING.md): `feat(api): [#BL-05] ...`.
- Nhánh: `feature/<tên-chức-năng>` → `dev` → `main`.
- PR phải qua CI (lint, test, build) và có ít nhất 1 người approve.
- Không commit secret; `.env.example` chỉ chứa placeholder.
