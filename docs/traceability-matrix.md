# BrewLite – Ma trận truy vết

| Thông tin | Nội dung |
|---|---|
| Tệp | `docs/traceability-matrix.md` |
| Phạm vi hiện tại | **Task 4.3 – MVP Sprint 1 (luồng xem menu)** |
| Đầu vào | `docs/requirements/srs.md`, `docs/requirements/use-case-checkout.md`, `docs/diagrams/*`, `docs/architecture/*` |

> **Phạm vi.** Ma trận này chỉ truy vết phần đã hiện thực ở Task 4.3. Các mã
> `FR-*`/`NFR-*` thuộc Sprint 2 (giỏ hàng, đặt đơn, thanh toán, đăng nhập…) sẽ
> bổ sung ở Task 5.1. Cột "Test" dùng mã test để đối chiếu trực tiếp với mã
> nguồn.

## 1. Yêu cầu chức năng

| Mã | Yêu cầu | Use-case / User story | Thiết kế / Sơ đồ | Code / API | Test |
|---|---|---|---|---|---|
| FR-01 | Xem menu theo danh mục, hiển thị hình ảnh, tên, giá cơ bản và tình trạng còn/hết hàng | UC-01 Xem menu và chi tiết món | `activity-01` (luồng xem menu); Class-01 `Product` | `GET /products`, `GET /products/:id` — `apps/api/src/modules/products/`; UI `apps/web/components/menu-screen.tsx`, `menu-card.tsx` | `products.service.spec.ts`, `products.controller.spec.ts`, `menu-screen.test.tsx`, `menu-card.test.tsx` |
| FR-02 | Xem chi tiết và chọn size/topping hợp lệ | UC-01 Xem menu và chi tiết món | Class-01 `ProductSize`, `Topping`; BR-01 | `GET /products/:id` trả `sizes[]`, `toppings[]` — `apps/api/src/modules/products/products.service.ts` | `products.service.spec.ts` (sắp xếp size, trả topping) |
| FR-14 | Validate và báo lỗi nhập liệu | Xuyên suốt | ADR-007 (ValidationPipe) | `main.ts` (`whitelist`, `forbidNonWhitelisted`); `ParseUUIDPipe` trong `products.controller.ts` | `products.controller.spec.ts`; kiểm tra HTTP 400/404 khi smoke test |

## 2. Yêu cầu phi chức năng

| Mã | Yêu cầu | Thiết kế / Sơ đồ | Code / API | Test / Minh chứng |
|---|---|---|---|---|
| NFR-01 | Hiệu năng API | `architecture.md` mục 8 | `GET /products` dùng index `products.category`, `products.is_available` | Smoke test: 100 request `< 500 ms` (xem `docs/architecture/deployment.md` mục 5) |
| NFR-02 | Khả dụng trong phiên nghiệm thu | ADR-007 (health check) | `GET /health` — `apps/api/src/modules/health/health.controller.ts`; `healthcheck` trong `docker-compose.yml` | `health.controller.spec.ts`; health trả 200 khi DB sẵn sàng, 503 khi mất DB |
| NFR-04 | Bảo vệ dữ liệu và cấu hình | ADR-006, ADR-007 | DB không publish cổng 5432 ra host; `.env` không commit; `.env.example` chỉ placeholder | `docker compose ps` — `db` không có `ports`; lỗi API trả message, không lộ stack trace |
| NFR-05 | Dễ dùng trên điện thoại | ADR-008 (mobile-first) | CSS `apps/web/app/globals.css`; viewport 360×800, 390×844 | Kiểm tra trình duyệt: không cuộn ngang, thẻ vừa khít 358 px ở viewport 390×844 |
| NFR-06 | Khả năng triển khai và tái tạo dữ liệu | ADR-003 (migration + seed) | `docker-compose.yml` (service `migrate`); `apps/api/migrations/`, `apps/api/seed/` | `npm run migration:run` + `npm run seed` trên DB rỗng; seed idempotent (chạy lại không nhân đôi) |
| NFR-07 | Kiểm thử và chất lượng trước triển khai | ADR-001 (monorepo) | Unit test backend (Vitest); component test frontend (Vitest + Testing Library) | `npm test` trong `apps/api` (19 test) và `apps/web` (15 test) |
| NFR-08 | Quan sát vận hành | ADR-007 (logging) | Log NestJS ra stdout kèm `requestId`; `docker compose logs` | `docker compose logs api` |

## 3. Yêu cầu về dữ liệu mẫu (Task 4.3)

| Nội dung | Nơi thực hiện | Minh chứng |
|---|---|---|
| Schema menu | `apps/api/src/database/migrations/1736000000000-CreateProductsSchema.ts` | Tạo được từ DB rỗng; `CHECK (stock_quantity >= 0)` |
| Dữ liệu mẫu | `apps/api/src/database/seed/data.ts` | 11 sản phẩm, 5 topping, 33 size, 12 liên kết |
| Seed idempotent | `apps/api/src/database/seed/seed.ts` (upsert theo `slug`) | Chạy lại 2 lần: số liệu không đổi |
| Tiền lưu số nguyên VND | Entity `base_price`, `price`, `total` kiểu `integer` | BR-01 |

## 4. Chưa hiện thực (thuộc Sprint 2)

| Mã | Nội dung | Task |
|---|---|---|
| FR-03, FR-04 | Giỏ hàng, tính tổng | Task 5.1 |
| FR-05, FR-06 | Đăng ký, đăng nhập, JWT | Task 5.1 |
| FR-07 … FR-10 | Đặt đơn, tồn kho, thanh toán mô phỏng, idempotency | Task 5.1 |
| FR-11 … FR-13 | Theo dõi đơn, lịch sử, quản lý trạng thái | Task 5.1 |
| FR-15 … FR-19, FR-22 | Mở rộng (khuyến mãi, tích đểm, quản trị, thống kê, realtime) | Task 5.1 (Could) |
| NFR-09 | Bàn giao và rollback | Task 5.4 |
| NFR-10 | PWA nâng cao, menu offline | Task 5.1 (Could) |

## 5. Truy vết ngược (từ code ra yêu cầu)

| Thành phần mã nguồn | Yêu cầu liên quan |
|---|---|
| `apps/api/src/modules/products/products.controller.ts` | FR-01, FR-02, FR-14 |
| `apps/api/src/modules/products/products.service.ts` | FR-01, FR-02, BR-01 |
| `apps/api/src/modules/health/health.controller.ts` | NFR-02 |
| `apps/api/src/database/entities/product.entity.ts` | FR-01, BR-01, BR-02 |
| `apps/api/src/database/seed/` | NFR-06 |
| `apps/web/components/menu-screen.tsx` | FR-01, FR-14 |
| `apps/web/components/menu-card.tsx` | FR-01 |
| `apps/web/components/empty-state.tsx` | FR-01 |
| `apps/web/components/error-state.tsx` | FR-01, FR-14 |
| `apps/web/lib/api.ts` | FR-01, FR-14 |
| `docker-compose.yml` | NFR-02, NFR-04, NFR-06 |
