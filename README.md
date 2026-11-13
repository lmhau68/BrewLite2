# BrewLite

Ứng dụng đặt đồ uống cho cửa hàng BrewLite. Luồng nghiệp vụ:
**Xem menu → Chọn tùy chọn → Giỏ hàng → Đặt đơn → Thanh toán → Theo dõi đơn**.

> **Trạng thái hiện tại — Sprint 2 (Task 5.1).** Ứng dụng có luồng từ xem menu,
> chọn size/topping, giỏ hàng, đăng nhập, đặt đơn đến checkout VNPay Sandbox và
> theo dõi/cập nhật trạng thái đơn. Thanh toán hỗ trợ VNPay Sandbox và luồng
> mô phỏng nội bộ để kiểm thử offline.

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

Giỏ hàng được lưu trong trình duyệt theo tài khoản, không nằm trong Docker
volume. Đóng/rebuild container không xóa giỏ; đăng xuất sẽ ẩn giỏ tài khoản và
chuyển sang giỏ khách rỗng, đăng nhập lại cùng tài khoản trên cùng trình duyệt
sẽ khôi phục. Xóa dữ liệu trình duyệt hoặc dùng thiết bị/trình duyệt khác sẽ
không khôi phục giỏ này.

Sau đó truy cập:

| Dịch vụ | URL |
|---|---|
| Frontend (menu) | http://localhost:3000 |
| API | http://localhost:3001 |
| Health check | http://localhost:3001/health |

Trước khi khởi động, thay `JWT_SECRET` trong `.env` bằng một chuỗi ngẫu nhiên
riêng tư dài tối thiểu 32 ký tự. VNPay Sandbox là môi trường kiểm thử, không
thu tiền thật. Luồng mô phỏng nội bộ vẫn có thể dùng khi chưa cấu hình VNPay.

### Tích hợp VNPay Sandbox

Đăng ký merchant test tại [VNPay Test](https://pay.vnpaytest.vn/dev-registration)
để nhận `TmnCode` và `HashSecret`. Điền chúng vào `.env` cùng các biến:

```env
VNPAY_TMN_CODE=<TmnCode>
VNPAY_HASH_SECRET=<HashSecret>
VNPAY_IPN_URL=https://<public-host>/payments/vnpay/ipn
WEB_APP_URL=http://localhost:3000
```

`VNPAY_IPN_URL` phải là URL công khai mà VNPay có thể gọi tới, đồng thời phải
được khai báo trong cấu hình merchant. Khi chạy local, dùng tunnel HTTPS hoặc
môi trường staging cho API callback; `localhost` không nhận được IPN từ VNPay.
Không gửi `HashSecret` qua chat và không commit `.env`. Sau khi cấu hình, chạy:

```bash
docker compose up -d --build
```

Ở trang thanh toán, chọn **VNPay Sandbox**. Ứng dụng tạo checkout URL ở backend
và chỉ xác nhận đơn sau khi backend nhận, kiểm tra chữ ký IPN và đối chiếu số
tiền. URL Return chỉ đưa khách quay lại trang đơn, không tự xác nhận thanh toán.
VNPay yêu cầu số tiền tối thiểu 5.000 VND.

Thông tin thẻ kiểm thử và kịch bản thành công/thất bại được công bố trong
[tài liệu demo VNPay](https://sandbox.vnpayment.vn/apis/vnpay-demo/). Chỉ dùng
thông tin test tại sandbox; không dùng thông tin thẻ/tài khoản thật.

### Kiểm thử VNPay Sandbox

Tạo đơn từ 5.000 VND trở lên, chọn VNPay Sandbox và tiếp tục tại trang checkout của VNPay. BrewLite tạo link thanh toán, không tự tạo mã QR. Nếu VNPay cung cấp VNPAY-QR cho merchant/test account, chọn phương thức đó tại trang checkout; nếu không, dùng phương thức kiểm thử khác được hiển thị (ví dụ thẻ test).

Chỉ dùng thông tin giao dịch kiểm thử VNPay, không dùng thẻ hay tài khoản thật.
Chỉ IPN hợp lệ mới cập nhật giao dịch thành công. Các phương thức QR/thẻ mô
phỏng nội bộ đã bị gỡ; API chỉ nhận VNPay Sandbox.

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
| `npm run test:integration` | Test PostgreSQL thật (cần `TEST_DATABASE_URL`) |

Test tích hợp tạo schema ngẫu nhiên riêng, chạy migration, tranh chấp hai yêu
cầu đặt cùng sản phẩm chỉ còn một đơn vị tồn kho, rồi xóa schema đó. Dùng
PostgreSQL test riêng và tài khoản có quyền tạo schema; không trỏ tới production.
Ví dụ PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgres://<user>:<password>@localhost:5432/<test_database>'
npm run test:integration
Remove-Item Env:TEST_DATABASE_URL
```

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
| POST / GET | `/payments` | Tạo giao dịch VNPay Sandbox hoặc tra cứu giao dịch (JWT). |
| GET | `/payments/vnpay/ipn` | Nhận và xác minh IPN từ VNPay Sandbox (không dùng JWT; cần chữ ký hợp lệ). |
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
| `/checkout/payment/:orderId` | Tạo giao dịch VNPay Sandbox và tiếp tục thanh toán tại cổng VNPay. |
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
