# ADR-006: Docker, CI/CD bằng GitHub Actions, registry và nền tảng triển khai

| Trạng thái | Ngày | Người đề xuất |
|---|---|---|
| **Proposed**: cần cả nhóm chốt nền tảng trước khi vẽ Task 3.2 | 05/11/2026 | Nhóm phát triển |

## Bối cảnh
Đề bài yêu cầu Docker, `docker-compose.yml` chạy web/api/db ở local, CI (install, lint, test, build), CD (build image, push registry, deploy, migration, smoke test, rollback), production qua HTTPS, DB không public, và **Deployment diagram phải phản ánh nền tảng thực tế**. Ngân sách gần bằng 0 (C-18).

## Quyết định
| Hạng mục | Quyết định |
|---|---|
| Đóng gói | Mỗi app một `Dockerfile` multi-stage (`apps/web`, `apps/api`); `docker-compose.yml` ở gốc chạy web, api, db với volume Postgres |
| CI | GitHub Actions `ci.yml` khi mở PR: install → lint → unit test → build; integration test dùng Postgres service container. Bắt buộc pass mới merge (branch protection) |
| Image tag | Commit SHA hoặc semver (`vX.Y.Z`) |
| Registry | **GHCR** (đề xuất) |
| CD | `cd.yml` khi push `main`/tag: quality gate → build image → push → deploy → migration → smoke test (`GET /health`, trang menu) → dừng pipeline nếu lỗi |
| Rollback | Triển khai lại image tag trước đó đã biết hoạt động; ghi giới hạn rollback dữ liệu trong `docs/deployment.md` |
| Secret | GitHub Secrets (CI) + secret store của nền tảng; không để trong repo hay log |
| **Nền tảng production** | **Chưa chốt.** Ứng viên: Render, Railway, Fly.io, VPS. Khi chốt, cập nhật mục này và `architecture.md` mục 4, 13 |

Tiêu chí chọn nền tảng: có gói miễn phí/rẻ; Postgres có persistent storage và không public; HTTPS tự động; health check; log; deploy từ image/registry; đủ tin cậy cho phiên nghiệm thu (NFR-02).

## Lý do
GitHub Actions gắn liền repo, miễn phí cho repo nhóm; Docker bảo đảm chạy giống nhau ở local, CI và production.

## Hạn chế và đánh đổi
- Gói miễn phí có thể ngủ đông/cold start → ghi nhận trong NFR-02, deploy thử sớm.
- Phụ thuộc nhà cung cấp; Docker giảm chi phí chuyển đổi.

## Hệ quả cho Task 3.2
Node và nhãn nền tảng trong diagram phải dùng **nền tảng đã chốt thực tế**. Ranh giới: Local / CI / Production.
Thành phần: COMP-LOCAL, COMP-CI, COMP-CD, COMP-REG, COMP-PLATFORM.
