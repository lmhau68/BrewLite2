# BrewLite – Mô tả kiến trúc triển khai (Task 3.2)

| Thông tin | Nội dung |
|---|---|
| Sơ đồ | Nguồn draw.io: [`deployment-diagram.drawio`](../diagrams/deployment-diagram.drawio) · ảnh xuất: `deployment-diagram.svg` / `.png` |
| Nền tảng production | **Render** (cloud, vùng Singapore, gói Free) theo ADR-006. Local dùng Docker Compose |
| Đầu vào | `architecture.md` mục 3, 4, 6–10; ADR-002, 003, 004, 005, 006, 007, 008 |
| Đối chiếu với mã nguồn | `docker-compose.yml`, `apps/*/Dockerfile`, `apps/api/start-render.sh`, `.github/workflows/ci.yml`, `cd.yml`, `docs/deployment.md` |
| Phạm vi | Sơ đồ mô tả **kiến trúc triển khai**. Hướng dẫn cấu hình, khởi tạo image lần đầu, rollback chi tiết nằm ở `docs/deployment.md` (Task 5.3) |

![Deployment diagram](../diagrams/deployment-diagram.svg)

> Sau khi chỉnh sửa trong draw.io, xuất lại `deployment-diagram.svg` (và `.png`) vào `docs/diagrams/` rồi commit cùng file `.drawio`.

## 1. Tổng quan

Sơ đồ có **ba ranh giới** theo ADR-006: **Local** (máy lập trình viên), **CI/CD** (GitHub Actions + GHCR) và **Production** (Render).

Production gồm hai Render Web Service chạy image Docker lấy từ GHCR (`brewlite-web`, `brewlite-api`) và một Render PostgreSQL (`brewlite-db`). Cả ba đặt cùng workspace và cùng vùng Singapore. Render kết thúc TLS ở lớp edge nên người dùng chỉ thấy HTTPS 443. Không có CDN riêng cho Web Service.

| Vùng | Mức tiếp xúc | Thành phần |
|---|---|---|
| **Z1 – Client** | Ngoài hệ thống, không tin cậy | Thiết bị người dùng, trình duyệt/PWA (COMP-BROWSER) |
| **Z2 – Render Edge** | Công khai | Kết thúc TLS, HTTPS 443, địa chỉ `*.onrender.com` |
| **Z3 – Render Web Service** | Công khai qua edge | `brewlite-web` (COMP-WEB), `brewlite-api` (COMP-API, có COMP-PAY) |
| **Z4 – Mạng riêng Render** | Nội bộ | Kết nối `api` → `db` bằng Internal Database URL |
| **Z5 – Dữ liệu** | Cô lập cao nhất | `brewlite-db` (COMP-DB) và managed storage 1 GB; Inbound IP rules để trống |
| **Z6 – CI/CD** | Ngoài Render | GitHub Actions (COMP-CI, COMP-CD), GHCR (COMP-REG), GitHub Secrets/Variables |
| **Z7 – Local** | Máy lập trình viên | Docker Compose: `db`, `migrate`, `api`, `web`, volume `pgdata` |

## 2. Bảng các luồng kết nối (khớp số trên sơ đồ)

| Số | Từ → Đến | Giao thức / cổng | Mục đích |
|---|---|---|---|
| [1] | Trình duyệt → `brewlite-web` | HTTPS 443 (`*.onrender.com`) | Tải giao diện Next.js, tài nguyên PWA |
| [2] | Trình duyệt → `brewlite-api` | HTTPS 443 + JWT, REST/JSON | Gọi nghiệp vụ: menu, đặt đơn, thanh toán. Web **không** gọi API qua mạng riêng; URL API là URL HTTPS công khai, nhúng vào Web lúc build (`NEXT_PUBLIC_API_URL`) |
| [3] | `brewlite-api` → `brewlite-db` | TCP 5432, Internal Database URL | Truy vấn, transaction; migration và seed lúc khởi động |
| [4] | `brewlite-api` → COMP-PAY | Gọi hàm nội bộ | Mock Payment chạy cùng tiến trình API (ADR-004) |
| [5] | `brewlite-db` → managed storage | Do Render quản lý | Lưu bền vững dữ liệu PostgreSQL (1 GB, không autoscale) |
| [6] | Developer → COMP-CI | `git push` / Pull Request | CI chạy khi mở PR và khi push `main`/`dev` |
| [7] | COMP-CI → COMP-CD | Sự kiện `workflow_run` | CD chỉ chạy khi CI của push lên `main` thành công; PR không kích hoạt CD |
| [8] | COMP-CD → GHCR | HTTPS 443 | Đẩy image `ghcr.io/lmhau68/brewlite2-{api,web}` với tag `sha-<SHA>` và `latest` |
| [9] | COMP-CD → Render (api, web) | HTTPS: Deploy Hook kèm `imgURL`; Render API | Yêu cầu Render chạy đúng image của commit đã kiểm tra. Render API dùng để chờ trạng thái deploy `live` và để rollback |
| [10] | Render → GHCR | HTTPS 443 | Render pull image (nếu package private thì cấu hình registry credential trên Render) |
| [11] | COMP-CD → Render (public URL) | HTTPS 443 | Smoke test: `GET /health` của API và `GET /` của Web |
| [12] | Trình duyệt dev → Compose local | HTTP `:3000` (web), `:3001` (api) | Dev/test. Thiết bị khác máy host dùng IP LAN (`LAN_HOST`) |

Mũi tên xám nét đứt không đánh số: Environment Variables của Render được đưa vào dịch vụ `api`.

## 3. Mô tả chi tiết từng vùng

### Z1 – Client

Trình duyệt Chrome/Firefox chạy Next.js mobile-first/PWA trên điện thoại hoặc máy chấm điểm. Vùng này không được tin cậy: mọi dữ liệu từ client (giá, tổng tiền, vai trò) đều được API kiểm tra lại; xác thực bằng JWT, phân quyền CUSTOMER/STAFF/MANAGER (ADR-005).

### Z2/Z3 – Render Edge và Web Service

- **Edge:** kết thúc TLS và chuyển lưu lượng HTTPS 443 vào cổng `PORT` của container. Ứng dụng nghe `PORT` do Render cấp (mặc định 10000); cổng 3000/3001 chỉ dùng ở local.
- **`brewlite-web`:** dịch vụ từ *Existing Image* `brewlite2-web`. Health Check Path `/`. `NEXT_PUBLIC_API_URL` được nhúng lúc build image (ADR-008), nên đổi URL API phải build lại image Web. Không có biến môi trường runtime bắt buộc.
- **`brewlite-api`:** dịch vụ từ *Existing Image* `brewlite2-api`, Docker Command `/bin/sh /app/start-render.sh`, Health Check Path `/health`. Biến môi trường: `DATABASE_URL` (Internal URL), `JWT_SECRET`, `CORS_ORIGIN`, `DB_MIGRATIONS_RUN=false`, `MOCK_PAYMENT_OUTCOME`, `SEED_STAFF_*`.
- **COMP-PAY:** module `payments` chạy cùng tiến trình API, không có cổng hay container riêng, không nhận dữ liệu thẻ thật.
- Dịch vụ tạo thủ công từ image, **không dùng `render.yaml`**. Auto-deploy từ Git được tắt để mọi bản phát hành đi qua CD.

### Z4/Z5 – Mạng riêng và dữ liệu

- Chỉ `api` kết nối `db` (luồng [3]) qua Internal Database URL. Danh sách Inbound IP rules của DB để trống nên không truy cập được từ Internet (NFR-04). Secret chứa chuỗi kết nối không đưa vào GitHub Actions.
- PostgreSQL 16, managed storage 1 GB, không autoscale, không High Availability.
- **Migration và seed** chạy khi `api` khởi động, không phải bước riêng của CD: `start-render.sh` chạy `node dist/database/prepare-production.js` rồi `exec node dist/main.js`. Script giữ advisory lock, chạy migration trong transaction, chỉ seed khi `products` và `toppings` đều rỗng, và dừng ngay nếu thất bại để API không mở cổng. Lý do: Render Free không có pre-deploy command (ADR-006).
- `GET /health` chạy `SELECT 1`, trả 200 khi API và DB sẵn sàng, 503 khi mất DB.

### Z6 – CI/CD (GitHub)

- **COMP-CI (`ci.yml`):** Install → Lint → Unit Test → Integration Test (Postgres service container) → Build cho API và Web; thêm job `docker` build hai image và khởi động thử theo cấu hình Render Free, kiểm tra `/health`, `/products` và chạy lại bước chuẩn bị DB.
- **COMP-CD (`cd.yml`):** quality gate → kiểm tra cấu hình Render → build và push image → lưu deploy `live` hiện tại → gọi Deploy Hook cho api và web → chờ deploy `live` → smoke test → rollback bằng Render API nếu thất bại.
- **COMP-REG (GHCR):** image gắn tag `sha-<SHA>` và `latest`; giữ lại image cũ để rollback.
- **Secrets/Variables:** `RENDER_API_DEPLOY_HOOK_URL`, `RENDER_WEB_DEPLOY_HOOK_URL`, `RENDER_API_KEY` (Secrets); `RENDER_API_URL`, `RENDER_WEB_URL`, `RENDER_API_SERVICE_ID`, `RENDER_WEB_SERVICE_ID` (Variables). Không đưa `DATABASE_URL` hay `JWT_SECRET` production vào GitHub.

### Z7 – Local (Docker Compose)

Bốn container trong mạng bridge `brewlite-net`: `db` (postgres:16-alpine, volume `pgdata`, **không publish 5432**), `migrate` (chạy một lần: migration + seed), `api` (publish 3001), `web` (publish 3000). Thứ tự khởi động: `db` healthy → `migrate` hoàn tất → `api` healthy → `web`. Cùng Dockerfile với CI và Render. `.env` không commit; `JWT_SECRET` bắt buộc.

## 4. Luồng đặt đơn và thanh toán

1. Khách tải giao diện từ `brewlite-web` ([1]); trình duyệt gọi `brewlite-api` bằng HTTPS kèm JWT ([2]).
2. API xác thực JWT, kiểm tra dữ liệu, tính giá và tồn kho ở phía server.
3. API mở transaction tới `brewlite-db` ([3]): tạo đơn, trừ tồn kho, commit hoặc rollback toàn bộ.
4. Khi thanh toán, API gọi COMP-PAY bằng hàm nội bộ ([4]); kết quả ghi vào DB ([3]) và trả về trình duyệt ([2]).

Chi tiết từng bước nằm ở `docs/diagrams/sequence-checkout.puml`.

## 5. Biện pháp bảo mật theo vùng

| Vùng | Biện pháp | Yêu cầu |
|---|---|---|
| Z1 | Không tin dữ liệu client; JWT; RolesGuard | NFR-03, FR-06 |
| Z2/Z3 | HTTPS tại edge; CORS giới hạn bằng `CORS_ORIGIN`; secret ở Render Environment Variables | NFR-03, NFR-04 |
| Z4/Z5 | DB chỉ truy cập bằng Internal URL; Inbound IP rules rỗng; transaction | NFR-04, NFR-06, FR-08 |
| Z6 | GitHub Secrets; PR lỗi không được merge; CD chỉ chạy khi CI `main` thành công | NFR-07, NFR-09 |
| Z7 | `.env` không commit; chỉ publish 3000 và 3001, không publish 5432 | NFR-04, NFR-06 |

## 6. Hạn chế của gói Free (theo ADR-006)

- Web Service ngủ sau 15 phút không truy cập, khởi động lại khoảng 1 phút: ảnh hưởng NFR-02, cần đánh thức trước phiên nghiệm thu.
- Mỗi workspace có 750 giờ instance miễn phí mỗi tháng.
- PostgreSQL Free giới hạn 1 GB và hết hạn sau 30 ngày kể từ lúc tạo; cần ghi nhận ngày hết hạn và có migration/seed để dựng lại.
- Rollback ứng dụng không khôi phục dữ liệu DB; ưu tiên migration tương thích ngược.

## 7. Truy vết sơ đồ ↔ kiến trúc ↔ mã nguồn

| Thành phần trên sơ đồ | Mục `architecture.md` | ADR | Mã nguồn / tệp |
|---|---|---|---|
| COMP-BROWSER | 3, 4 | ADR-008 | sinh ra từ `apps/web/` |
| COMP-WEB (`brewlite-web`) | 3, 3.1, 4 | ADR-002, 008 | `apps/web/`, `apps/web/Dockerfile` |
| COMP-API (`brewlite-api`) | 4, 5, 8 | ADR-002, 005, 007 | `apps/api/`, `apps/api/Dockerfile`, `apps/api/src/modules/health/health.controller.ts` |
| Khởi động API (migration + seed) | 6, 8 | ADR-003, 006 | `apps/api/start-render.sh`, `apps/api/src/database/prepare-production.ts` |
| COMP-PAY | 7 | ADR-004 | `apps/api/src/modules/payments/` |
| COMP-DB (`brewlite-db`) | 6 | ADR-003 | `apps/api/src/database/migrations/`, `apps/api/src/database/seed/` |
| COMP-PLATFORM (Render) | 4, 10 | ADR-006 | `docs/deployment.md` mục 3 |
| COMP-LOCAL | 4, 10 | ADR-006 | `docker-compose.yml`, `.env.example` |
| COMP-CI | 10 | ADR-006 | `.github/workflows/ci.yml` |
| COMP-CD | 10 | ADR-006 | `.github/workflows/cd.yml` |
| COMP-REG (GHCR) | 10 | ADR-006 | image `ghcr.io/lmhau68/brewlite2-{api,web}` đẩy từ `cd.yml` |

> **Cần đồng bộ:** bảng ở `architecture.md` mục 4 còn ghi đường dẫn dự kiến (`apps/api/src/payments/gateway/`, `apps/api/migrations/`, `apps/api/seed/`) và tên interface `PaymentGateway`, trong khi mã nguồn hiện tại nằm ở `apps/api/src/modules/payments/` và `apps/api/src/database/`. Mục này cũng ghi COMP-LOCAL chạy "db 5432"; thực tế `db` không publish cổng 5432 ra host.
