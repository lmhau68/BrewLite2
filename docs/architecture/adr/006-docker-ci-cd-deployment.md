# ADR-006: Triển khai production trên Render (cloud); Docker Compose cho local; CI/CD bằng GitHub Actions

| Trạng thái | Ngày | Người đề xuất |
|---|---|---|
| Accepted (thay thế quyết định "Local Docker Compose" ngày 05/11/2026) | 11/11/2026 | Nhóm phát triển (theo chỉ đạo của giảng viên) |

> Bổ sung Task 5.3 ngày 13/11/2026: nhóm chọn Render Free. Migration và seed
> khởi tạo chạy trong bước chuẩn bị trước khi API mở cổng, vì gói Free không
> có pre-deploy command và Shell. Nền tảng, mạng riêng và cách đóng gói giữ
> theo quyết định bên dưới.

## Bối cảnh
Đề bài yêu cầu Docker, `docker-compose.yml` chạy web/api/db ở local, CI (install, lint, test, build), CD (build image, push registry, deploy, migration, smoke test, rollback), và **production truy cập được qua HTTPS**, database không public. Deployment diagram phải phản ánh nền tảng thực tế.
Ban đầu nhóm định chạy hoàn toàn trên Docker Compose local. Giảng viên chỉ đạo **triển khai trên cloud bằng dịch vụ Render**. Quyết định này thay thế quyết định cũ; Docker Compose vẫn dùng cho môi trường local.

## Quyết định
| Hạng mục | Quyết định |
|---|---|
| **Nền tảng production (COMP-PLATFORM)** | **Render** (cloud) |
| COMP-WEB | **Render Web Service** chạy image Docker của `apps/web` (Next.js) |
| COMP-API | **Render Web Service** chạy image Docker của `apps/api` (NestJS) |
| COMP-DB | **Render PostgreSQL** (managed). API dùng **Internal Database URL** qua mạng riêng của Render; **không mở truy cập từ ngoài** (để danh sách IP được phép truy cập ngoài trống) |
| HTTPS | Render cấp chứng chỉ TLS và kết thúc HTTPS ở lớp edge của Render cho cả `web` và `api` (`https://<tên>.onrender.com`). Không có CDN riêng cho Web Service |
| Cổng | Trong container, ứng dụng lắng nghe cổng do biến `PORT` của Render cấp (mặc định Render là 10000); `docker-compose.yml` local dùng 3000/3001. Ra ngoài chỉ có HTTPS 443 |
| Local | `docker-compose.yml` chạy web, api, db và volume PostgreSQL, dùng để phát triển và để người ngoài nhóm chạy theo README |
| Đóng gói | Mỗi app một `Dockerfile` multi-stage (`apps/web`, `apps/api`), dùng chung cho local, CI và Render |
| CI | GitHub Actions `ci.yml` khi mở PR: install → lint → unit test → build; integration test dùng Postgres service container. Bắt buộc pass mới merge |
| Image tag | Commit SHA hoặc semver (`vX.Y.Z`) |
| Registry | **GHCR** (đề xuất): lưu image đã gắn tag. Render chạy "image từ registry"; nếu image private thì cấu hình credential của registry trên Render |
| CD / deploy | Quality gate → build image → push GHCR → gọi **Render deploy hook/API** để deploy image tag mới → migration → smoke test (`GET /health` của API, trang menu của web) → dừng và báo lỗi nếu smoke test thất bại |
| Migration | Với Render Free, Docker Command chạy `node dist/database/prepare-production.js` trước `exec node dist/main.js`. Preparation dùng advisory lock, migration trong transaction và chỉ seed khi cả catalog sản phẩm/topping còn rỗng; API chỉ mở cổng sau khi thành công. Gói trả phí có thể chuyển preparation sang pre-deploy command. Migration phải tương thích với API cũ còn nhận traffic |
| Health check | Khai báo **Health Check Path = `/health`** cho `api` trên Render; Render chỉ chuyển lưu lượng khi health check đạt |
| Secret | **Environment Variables của Render** (`DATABASE_URL`, `JWT_SECRET`...) và **GitHub Secrets** cho CI/CD (Render API key, deploy hook, GHCR token). Không commit secret; không in ra log CI |
| Log | Log stdout JSON (ADR-007), xem ở tab Logs của từng service trên Render |
| Rollback | Triển khai lại image tag trước đó đã biết hoạt động (qua deploy hook hoặc bảng điều khiển Render); nêu giới hạn rollback dữ liệu trong `docs/deployment.md` |

## Lý do
- Đáp ứng chỉ đạo của giảng viên và yêu cầu production HTTPS của đề bài, không phải tự dựng TLS, reverse proxy hay máy chủ.
- Render có sẵn HTTPS, mạng riêng giữa service và database, health check, quản lý biến môi trường, log, triển khai từ image Docker.
- Vẫn dùng cùng Dockerfile cho local, CI và production, nên môi trường nhất quán.

## Hạn chế và đánh đổi
Theo tài liệu của Render về gói miễn phí (kiểm tra ngày 11/11/2026):
- **Web Service miễn phí tự ngủ sau 15 phút không có truy cập**, và khởi động lại mất khoảng 1 phút khi có request mới. Ảnh hưởng **NFR-02** (29/30 lần kiểm tra thành công): cần "đánh thức" dịch vụ trước phiên nghiệm thu/demo, hoặc ghi nhận cold start như NFR-02 đã cho phép, hoặc dùng gói trả phí.
- **Mỗi workspace có 750 giờ instance miễn phí mỗi tháng**; hết giờ thì các Web Service miễn phí bị tạm ngưng đến tháng sau. Hai service chạy liên tục có thể dùng hết hạn mức này.
- **PostgreSQL miễn phí giới hạn 1 GB và hết hạn sau 30 ngày kể từ lúc tạo** (có thêm 14 ngày ân hạn rồi bị xóa vĩnh viễn). **Nếu tạo DB quá sớm, DB có thể hết hạn trước ngày chấm.** Nhóm cần tạo DB đúng thời điểm, hoặc nâng cấp gói, và có script seed/migration để dựng lại nhanh (NFR-06).
- Gói miễn phí không phù hợp tải thật; chấp nhận vì mục tiêu là demo và nghiệm thu.
- Phụ thuộc nhà cung cấp; dùng Docker nên có thể chuyển nền tảng khác mà không đổi kiến trúc.
- Một số tính năng (ví dụ pre-deploy command, tài nguyên lớn hơn) có thể chỉ có ở gói trả phí; cần kiểm tra khi triển khai thực tế.

## Phương án đã loại
| Phương án | Lý do loại |
|---|---|
| Local Docker Compose làm production | Không có URL HTTPS công khai; trái chỉ đạo của giảng viên |
| Railway, Fly.io, VPS | Giảng viên chỉ định Render |
| Static export của Next.js lên Static Site có CDN | Mất SSR; chọn Web Service để thống nhất cách đóng gói bằng Docker |

## Hệ quả cho Task 3.2 (Deployment diagram)
- Ba ranh giới: **Local** (máy lập trình viên, Docker Compose), **CI/CD** (GitHub Actions, GHCR), **Production** (Render).
- Trong Render: hai Web Service (`web`, `api`) và một PostgreSQL; kết nối `api` → `db` bằng mạng riêng, **không có đường từ Internet vào `db`**.
- Người dùng (trình duyệt/PWA) → HTTPS 443 → `web` và `api` (edge của Render kết thúc TLS).
- Ghi cấu hình: Environment Variables/secret, Health Check `/health`, log stdout.
- GHCR là nguồn image; CD gọi Render deploy hook.

Thành phần: COMP-LOCAL, COMP-CI, COMP-CD, COMP-REG, COMP-PLATFORM (Render), COMP-WEB, COMP-API, COMP-DB.
