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
riêng tư dài tối thiểu 32 ký tự. `MOCK_PAYMENT_OUTCOME` nhận `SUCCESS`,
`FAILED` hoặc `TIMEOUT` để thử các kết quả thanh toán giả lập. Thanh toán ngân
hàng/QR chỉ phục vụ demo; không kết nối ngân hàng và không xử lý tiền thật.

### Quét QR demo bằng điện thoại

QR thanh toán là một liên kết demo. Điện thoại dùng camera quét mã và mở liên
kết; máy chủ xác nhận outcome mô phỏng, rồi trang thanh toán trên máy tính tự
cập nhật trạng thái. Đây **không phải** QR chuyển khoản và không thể kiểm tra
giao dịch ngân hàng thật.

Để điện thoại mở được liên kết, máy tính và điện thoại cần cùng mạng Wi-Fi:

1. Với cấu hình mặc định, mở web trên máy tính tại
   `http://192.168.1.12:3000`. Nếu mở bằng `localhost`, QR tự thay địa chỉ đó
   bằng `192.168.1.12`; không cần nhập IP trong giao diện.
2. Khi mở trang thanh toán của đơn mới, giao dịch QR `PENDING` và mã QR được
   tạo tự động. Dùng camera điện thoại quét rồi mở liên kết; chỉ lúc đó kết quả
   mô phỏng mới được xác nhận. Trang máy tính tự cập nhật và chỉ xóa món khỏi
   giỏ khi thanh toán thành công.
3. Nếu muốn dùng thẻ thay vì QR đang chờ, chọn **Hủy QR và chọn thẻ**. Việc
   quét QR đã hủy không thể xác nhận thanh toán.
4. Nếu IP mạng nội bộ thay đổi, đặt `LAN_HOST` và `NEXT_PUBLIC_LAN_HOST` trong
   `.env` thành IP mới rồi chạy lại `docker compose up -d --build`. Cho phép
   cổng 3000/3001 qua Windows Firewall trên mạng Private.

Nếu không kết nối được, kiểm tra hai thiết bị cùng Wi-Fi và Windows Firewall
cho phép cổng 3000/3001 trong mạng riêng.

### Kiểm thử các kết quả thanh toán mô phỏng

Đặt `MOCK_PAYMENT_OUTCOME` trong `.env` rồi khởi động lại API trước mỗi lần đổi
giá trị. Dùng một đơn mới đang chờ thanh toán và một `Idempotency-Key` UUID mới
cho mỗi lần POST. QR luôn tạo giao dịch `PENDING`; giao dịch được xác nhận khi
điện thoại mở URL mã QR. Việc tra cứu trạng thái chỉ đọc.

Để thử lỗi, đổi giá trị trong `.env` thành `MOCK_PAYMENT_OUTCOME=FAILED`, rồi
khởi động lại API. Với Docker Compose, chạy:

```bash
docker compose up -d --force-recreate api
```

Chạy local thì khởi động lại tiến trình API.

```bash
# Tạo giao dịch QR (phản hồi luôn là PENDING)
curl -X POST http://localhost:3001/payments \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 00000000-0000-4000-8000-000000000003" \
  -d '{"orderId":"<ORDER_UUID>","method":"WALLET"}'

# Điện thoại sẽ gọi endpoint này khi mở link QR (không cần JWT; cần token trong QR)
curl -X POST http://localhost:3001/payments/<PAYMENT_UUID>/mock-scan \
  -H "Content-Type: application/json" \
  -d '{"scanToken":"<QR_SCAN_TOKEN>"}'
```

| `MOCK_PAYMENT_OUTCOME` | Kết quả mong đợi |
|---|---|
| `SUCCESS` | Điện thoại mở link QR: giao dịch thành `SUCCESS`, đơn thành `PAID`; giao diện máy tính cập nhật giỏ hàng. |
| `FAILED` | Điện thoại mở link QR: giao dịch thành `FAILED`, đơn thành `PAYMENT_FAILED`; có thể tạo giao dịch mới với key khác. |
| `TIMEOUT` | Link QR báo chưa xác định và giữ `PENDING`; `GET /payments/<PAYMENT_UUID>` chỉ đọc. Có thể đổi outcome rồi quét/mở lại link. Với thẻ đang `PENDING`, giao diện có nút mô phỏng nhận kết quả ngân hàng riêng. |

Để thử từng outcome độc lập, nên dùng đơn mới. Có thể thử lại đơn `FAILED` với
key mới; với `TIMEOUT`, không tạo POST giao dịch mới. Gửi lại cùng key và cùng
nội dung sẽ trả về cùng giao dịch; dùng lại key với nội dung khác sẽ bị từ chối.

> Đây là mô phỏng nội bộ: mở liên kết QR đánh dấu kết quả giả lập theo
> `MOCK_PAYMENT_OUTCOME`, không kết nối ngân hàng/cổng thanh toán và không nhận
> tiền thật. Muốn xác minh giao dịch thật cần tích hợp nhà cung cấp.

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
| POST / GET | `/payments` | Tạo giao dịch mô phỏng / tra cứu giao dịch (JWT). |
| POST | `/payments/:paymentId/mock-scan` | Xác nhận link QR demo bằng token một lần từ mã QR. |
| POST | `/payments/:paymentId/mock-cancel` | Hủy giao dịch QR đang chờ để đổi sang thẻ (JWT). |
| POST | `/payments/:paymentId/mock-result` | Mô phỏng kết quả thẻ/ngân hàng khi giao dịch timeout (JWT, demo). |
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
| `/checkout/payment/:orderId` | Thanh toán mô phỏng; quét link QR bằng điện thoại hoặc dùng thẻ giả lập. |
| `/mock-payment/scan` | Đích đến của link QR demo; tự gửi kết quả mô phỏng về API. |
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
