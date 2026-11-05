# ADR-006: Local Docker Compose làm nền tảng triển khai/vận hành cốt lõi; CI/CD bằng GitHub Actions

| Trạng thái | Ngày | Người đề xuất |
|---|---|---|
| Accepted | 05/11/2026 | Nhóm phát triển (theo chỉ đạo của trưởng nhóm) |

## Bối cảnh
Đề bài yêu cầu Docker, `docker-compose.yml` chạy web/api/db, CI (install, lint, test, build), CD (build image, push registry, deploy, migration, smoke test, rollback), và Deployment diagram phải phản ánh **nền tảng thực tế** nhóm dùng. Ngân sách gần bằng 0 (C-18), nhân lực là sinh viên. Nhóm đã thống nhất chạy hệ thống hoàn toàn trên **môi trường Local (Docker Compose)** thay vì thuê nền tảng đám mây.

## Quyết định
| Hạng mục | Quyết định |
|---|---|
| **Nền tảng triển khai/vận hành cốt lõi (COMP-PLATFORM)** | **Local Docker Compose**: chạy trên môi trường local (máy) của nhóm. Gồm 3 service: `web` (Next.js), `api` (NestJS), `db` (PostgreSQL + named volume) |
| Đóng gói | Mỗi app một `Dockerfile` multi-stage (`apps/web`, `apps/api`); `docker-compose.yml` ở gốc repo |
| Mạng | Service nối với nhau qua mạng nội bộ của Compose. Chỉ `web` (3000) và `api` (3001) được publish ra máy chủ; **`db` (5432) không publish ra ngoài**, chỉ `api` truy cập được |
| Dữ liệu | Named volume cho PostgreSQL, giữ dữ liệu khi restart container (NFR-06) |
| CI | GitHub Actions `ci.yml` khi mở PR: install → lint → unit test → build; integration test dùng Postgres service container. Bắt buộc pass mới merge |
| Image tag | Commit SHA hoặc semver (`vX.Y.Z`) |
| Registry | GHCR (đề xuất): lưu image đã gắn tag để `docker compose pull` và để rollback về tag cũ |
| CD / deploy | Quality gate → build image → push GHCR → trên máy chủ chạy `docker compose pull && docker compose up -d` → chạy migration → smoke test (`GET /health`, trang menu) → dừng và báo lỗi nếu smoke test thất bại |
| Rollback | Đổi biến tag image về phiên bản trước đã biết hoạt động rồi `docker compose up -d`; nêu giới hạn rollback dữ liệu trong `docs/deployment.md` |
| Secret | File `.env` trên máy chủ (không commit) và GitHub Secrets cho CI; `.env.example` chỉ có placeholder |
| Log / health | `docker compose logs` (stdout JSON, ADR-007); health check khai báo trong Compose (`healthcheck`) gọi `GET /health` |

## Lý do
- Không phụ thuộc gói miễn phí của nhà cung cấp (ngủ đông, đổi chính sách, giới hạn tài nguyên).
- Môi trường giống nhau giữa máy các thành viên, đúng yêu cầu `docker-compose.yml` chạy web/api/db.
- Nhóm tự kiểm soát hoàn toàn, chi phí bằng 0.

## Hạn chế và đánh đổi
- **Đề bài (mục 7.4, 8) yêu cầu URL frontend/API production truy cập được qua HTTPS và nêu rõ: không có URL production hoạt động tại thời điểm chấm thì phần triển khai của Task 5 không được tính.** Compose chạy trên máy local mặc định chỉ truy cập qua `http://localhost`, không có HTTPS công khai. Đây là rủi ro lớn nhất của quyết định này.
- Muốn đáp ứng, nhóm phải bổ sung một cách phơi bày hệ thống ra Internet qua HTTPS (ví dụ reverse proxy có TLS trên VPS/máy có IP công khai, hoặc tunnel như Cloudflare Tunnel). Cách này **chưa được chọn** và cần nhóm quyết định trước Task 5.4.
- Máy chủ phải bật trong phiên nghiệm thu (NFR-02); không có tự phục hồi hay cân bằng tải.
- Không có cơ chế deploy tự động hoàn toàn nếu máy chủ không nhận được lệnh từ GitHub Actions (cần self-hosted runner hoặc chạy bước deploy thủ công và ghi lại).

## Phương án đã loại (tại thời điểm này)
| Phương án | Lý do loại |
|---|---|
| Render / Railway / Fly.io | Nhóm chọn tự chạy Docker Compose để không phụ thuộc gói miễn phí |
| VPS thuê riêng | Phát sinh chi phí; vẫn có thể dùng Docker Compose trên VPS sau này mà không đổi kiến trúc |
| Kubernetes | Quá phức tạp cho phạm vi bài tập |

## Hệ quả cho Task 3.2 (Deployment diagram)
- Node thực thi là **một máy local chạy Docker Compose**, bên trong có 3 container `web`, `api`, `db` và volume PostgreSQL.
- `db` chỉ có kết nối nội bộ từ `api` (cổng 5432), **không vẽ đường ra Internet**.
- Vẽ ranh giới Local / CI (GitHub Actions) / Môi trường chạy Compose, cùng GHCR là nơi lưu image.
- Nếu nhóm bổ sung reverse proxy hoặc tunnel HTTPS, thêm node đó vào sơ đồ và cập nhật ADR này.

Thành phần: COMP-LOCAL, COMP-CI, COMP-CD, COMP-REG, COMP-PLATFORM.
