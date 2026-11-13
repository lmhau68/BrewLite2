# Hướng dẫn triển khai BrewLite

Tài liệu phục vụ Task 5.3, mô tả cấu hình CI/CD và triển khai trên Render Free.
Workflow `cd.yml` tiếp tục sau khi CI của sự kiện push lên `main` thành công.
PR chạy các bước kiểm tra, không đẩy image lên registry hoặc triển khai ứng dụng.
Không đưa mật khẩu, token hoặc URL kết nối database có thông tin đăng nhập vào repo.

## 1. Luồng CI/CD

`Push main → CI → Build image → GHCR → Render → Smoke test`

- CI kiểm tra lint, unit test, integration test và build API/Web.
- Job Docker build hai image, chạy thử container và kiểm tra dữ liệu khởi tạo.
- CD chỉ tiếp tục khi toàn bộ CI thành công.
- Image được gắn tag commit SHA và `latest`, sau đó đẩy lên GHCR.
- Deploy hook yêu cầu Render chạy image của đúng commit đã kiểm tra.
- Pipeline chờ kết quả triển khai trước khi kiểm tra API `/health` và trang Web.
- Khi có lỗi, pipeline báo thất bại và xử lý rollback theo trạng thái deploy.

## 2. Kiểm tra Docker trong CI

Job `docker` trong `ci.yml` chạy sau hai job API và Web trên runner Ubuntu.
Job build image cho Linux AMD64 với `push: false`, nạp image vào Docker của
runner và chạy cùng PostgreSQL 16 tạm phục vụ kiểm thử.

Các bước kiểm tra gồm:
- API `/health` và trang Web trả về HTTP 200.
- API `/products` trả về danh sách món đã được seed.
- Chạy lại bước chuẩn bị database với catalog đã có dữ liệu.
- Sử dụng lệnh khởi động và biến `PORT` tương ứng với Render Free.

Job dùng thông tin đăng nhập kiểm thử, không đăng nhập GHCR và không gọi Render.
Kết quả của job là một phần quality gate bắt buộc trước khi CD phát hành image.

## 3. Cấu hình Render

Dùng một Render PostgreSQL và hai Web Service chạy image từ GHCR.
Đặt cả ba dịch vụ trong cùng workspace và cùng vùng **Singapore** để API kết
nối database qua mạng riêng. Web gọi API bằng URL HTTPS công khai.

### 3.1. PostgreSQL

| Thiết lập | Giá trị |
|---|---|
| Name | `brewlite-db` |
| PostgreSQL Version | `16` |
| Region | Singapore |
| Compute | Free |
| Storage | 1 GB |
| Storage Autoscaling | Disabled |
| High Availability | Disabled |
| PostgreSQL Inbound IP Rules | Để trống danh sách để chặn kết nối từ Internet |

Dùng **Internal Database URL** cho biến `DATABASE_URL` của API trên Render.
Không dùng External Database URL hoặc đưa URL database vào GitHub Actions.
Giữ nguyên các quy tắc dùng chung của workspace khi chỉnh quy tắc riêng của database.

### 3.2. API

Tạo Web Service bằng **Existing Image**, trỏ đến image API đã có trên GHCR.

| Thiết lập | Giá trị |
|---|---|
| Image | `ghcr.io/lmhau68/brewlite2-api:sha-<SHA>` |
| Region | Singapore |
| Compute | Free |
| Health Check Path | `/health` |
| Pre-Deploy Command | Để trống |
| Docker Command | `/bin/sh /app/start-render.sh` |

Các biến môi trường của API:

| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | Internal Database URL của Render PostgreSQL |
| `JWT_SECRET` | Chuỗi ngẫu nhiên riêng tư, tối thiểu 32 ký tự |
| `CORS_ORIGIN` | URL HTTPS của Web; cập nhật sau khi tạo Web Service |
| `DB_MIGRATIONS_RUN` | `false` |
| `DB_LOGGING` | `false` |
| `VNPAY_TMN_CODE` | TmnCode do merchant test VNPay cấp |
| `VNPAY_HASH_SECRET` | HashSecret của merchant test; lưu dưới dạng secret, không đưa vào Git |
| `VNPAY_IPN_URL` | `https://<api-service>.onrender.com/payments/vnpay/ipn`, phải cấu hình trùng với IPN URL của merchant VNPay |
| `WEB_APP_URL` | URL HTTPS công khai của Web Service, ví dụ `https://brewlite-web-it8r.onrender.com` |
| `SEED_STAFF_EMAIL` | Email nhân viên demo nếu cần tạo tài khoản ban đầu |
| `SEED_STAFF_PASSWORD` | Mật khẩu nhân viên demo, cấu hình cùng email trước lần khởi động đầu |
| `SEED_STAFF_NAME` | Tên nhân viên demo nếu cần |

API đọc `PORT` do Render cấp và lắng nghe trên `0.0.0.0`.
Lệnh chuẩn bị database chạy trước khi API mở cổng nhận request:
1. Giữ advisory lock để các lần khởi động không chạy migration/seed đồng thời.
2. Chạy migration trong transaction.
3. Chỉ seed khi cả hai bảng `products` và `toppings` đều rỗng.
4. Bỏ qua seed khi catalog đã có dữ liệu, giữ nguyên tồn kho và mã size.
5. Giải phóng khóa rồi kết thúc; API chỉ khởi động khi lệnh trả về thành công.

Script `start-render.sh` dùng `set -eu` để dừng khi chuẩn bị database thất bại, chặn bước
khởi động API. Render giữ phiên bản đang hoạt động khi bản mới không vượt qua
health check. Migration phải tương thích với phiên bản cũ còn nhận traffic.

Render Free không có pre-deploy command và Shell. Vì vậy, phương án này dùng
Docker Command để chạy script trong image, không yêu cầu chạy seed thủ công qua Shell.
Không ghép nhiều lệnh trực tiếp trong ô Docker Command để tránh lỗi xử lý dấu nháy.
Script dùng `exec` để API nhận tín hiệu dừng trực tiếp. Image phải được build lại
sau khi thêm script; image cũ không có `/app/start-render.sh`.

### 3.3. Web

| Thiết lập | Giá trị |
|---|---|
| Image | `ghcr.io/lmhau68/brewlite2-web:sha-<SHA>` |
| Region | Singapore |
| Compute | Free |
| Health Check Path | `/` |
| Docker Command | Để trống, dùng lệnh `npm run start` của image |

`NEXT_PUBLIC_API_URL` được nhúng khi build image Web. Đổi URL API phải build lại
image; chỉ thêm biến vào môi trường chạy của Render không thay đổi bản Web đã build.
Giữ `WEB_APP_URL` của API đồng bộ với URL Web Service và đặt URL này trong
`CORS_ORIGIN` để trình duyệt gọi API được.

### 3.4. VNPay Sandbox

Đăng ký merchant test tại [VNPay Test](https://pay.vnpaytest.vn/dev-registration).
Có thể điền URL Web Service công khai vào trường website của form, ví dụ
`https://brewlite-web-it8r.onrender.com`. Việc VNPay chấp nhận website demo và
cấp merchant test do VNPay quyết định; không đưa thông tin giả hoặc thông tin
đăng nhập vào repository.

Sau khi có `TmnCode` và `HashSecret`, nhập chúng trực tiếp vào Environment của
API Web Service trên Render, không commit vào `.env.example` hoặc Git. Đặt
`VNPAY_IPN_URL` thành URL API công khai cộng với `/payments/vnpay/ipn`, sau đó
khai báo chính xác URL callback này trong cấu hình merchant VNPay. Ví dụ:

```text
VNPAY_IPN_URL=https://<api-service>.onrender.com/payments/vnpay/ipn
WEB_APP_URL=https://brewlite-web-it8r.onrender.com
```

Sau khi cập nhật Environment, triển khai lại API. VNPay Sandbox thanh toán chỉ
hoàn tất trong ứng dụng khi IPN tới API, chữ ký và số tiền được xác minh. URL
Return của trình duyệt chỉ đưa người dùng về website; không dùng Return để đánh
dấu đơn đã thanh toán. Dùng riêng dữ liệu test do VNPay công bố.

## 4. Khởi tạo image lần đầu

Render kiểm tra image tồn tại trước khi tạo dịch vụ từ registry. Trong khi đó,
CD cần có cấu hình Render trước khi phát hành. Một thành viên có Docker thực
hiện bước khởi tạo image lần đầu sau khi CI của commit được chọn đã thành công.

Từ thư mục gốc repo, đăng nhập GHCR và tạo image API:

```powershell
$task53Sha = git rev-parse HEAD
docker login ghcr.io
docker build --platform linux/amd64 -t "ghcr.io/lmhau68/brewlite2-api:sha-$task53Sha" apps/api
docker push "ghcr.io/lmhau68/brewlite2-api:sha-$task53Sha"
```

Tài khoản đăng nhập phải có quyền đẩy package của nhóm. Không ghi token vào
file code, tài liệu hoặc lệnh được chia sẻ. Nếu package riêng tư, cấu hình
registry credential có quyền đọc trên Render.

Sau khi có image API:
1. Tạo API Web Service theo mục 3.2 và chờ dịch vụ hoạt động.
2. Ghi nhận URL HTTPS của API.
3. Build image Web với URL API thực tế, rồi đẩy image lên GHCR:

```powershell
docker build --platform linux/amd64 --build-arg NEXT_PUBLIC_API_URL="https://<ten-api>.onrender.com" -t "ghcr.io/lmhau68/brewlite2-web:sha-$task53Sha" apps/web
docker push "ghcr.io/lmhau68/brewlite2-web:sha-$task53Sha"
```

Thay URL mẫu bằng URL API thực tế, không thêm dấu `/` ở cuối.
Tạo Web Service theo mục 3.3, rồi cập nhật `CORS_ORIGIN` của API bằng URL Web.
Cấu hình các biến và secret của GitHub Actions theo mục 5.
Tắt cơ chế tự triển khai độc lập từ Git để bản phát hành đi qua pipeline CD.

Đây là bước thiết lập ban đầu. Những lần phát hành sau do CI/CD thực hiện
tự động sau khi code được đưa vào `main` và vượt qua quality gate.

## 5. Biến và secret trong GitHub Actions

Thêm các **Repository Variables**:

| Tên | Giá trị |
|---|---|
| `RENDER_API_URL` | URL HTTPS của API, không có dấu `/` cuối |
| `RENDER_WEB_URL` | URL HTTPS của Web, không có dấu `/` cuối |
| `RENDER_API_SERVICE_ID` | Mã API Web Service trên Render, dạng `srv-...` |
| `RENDER_WEB_SERVICE_ID` | Mã Web Service trên Render, dạng `srv-...` |

Thêm các **Repository Secrets**:

| Tên | Giá trị |
|---|---|
| `RENDER_API_DEPLOY_HOOK_URL` | Deploy hook của API |
| `RENDER_WEB_DEPLOY_HOOK_URL` | Deploy hook của Web |
| `RENDER_API_KEY` | API key của Render để theo dõi deploy và yêu cầu rollback |

`GITHUB_TOKEN` do Actions cấp, chỉ nhận quyền `packages: write` trong job
phát hành image. Không thêm `DATABASE_URL` hoặc `JWT_SECRET` production vào
GitHub Actions; hai giá trị này thuộc môi trường API trên Render.

Deploy hook dùng image của commit đã kiểm tra. API key dùng để chờ đúng bản
deploy hoàn tất, tránh nhầm phản hồi từ phiên bản cũ thành kết quả triển khai mới.

## 6. Smoke test và rollback

Smoke test yêu cầu HTTP 200 từ API `/health` và trang Web.
Migration, khởi động dịch vụ hoặc smoke test thất bại đều khiến pipeline báo lỗi.

Trước khi triển khai, pipeline lưu mã deploy đang hoạt động của API và Web.
Nếu bản mới đã được đưa vào phục vụ nhưng smoke test thất bại, pipeline yêu cầu
rollback về các mã deploy đã lưu và chờ kết quả. Nếu bản mới thất bại trước khi
được đưa vào phục vụ, Render tiếp tục dùng bản đang hoạt động.

Nếu chưa có phiên bản cũ hoặc trạng thái deploy chưa rõ, kiểm tra từng dịch vụ
trong **Render Dashboard → Deploys** và xử lý hủy/rollback thủ công.
Giữ lại các image đã phát hành trong GHCR để Render có thể tải lại khi rollback.

Rollback ứng dụng không tự khôi phục dữ liệu database. Ưu tiên migration tương
thích ngược; thay đổi phá vỡ tương thích cần có phương án khôi phục dữ liệu trước
khi phát hành.

## 7. Lưu ý khi nghiệm thu

Render Free có thể ngủ khi không có truy cập và khởi động lại khi nhận request.
Database Free có thời hạn sử dụng; ghi nhận ngày hết hạn và chuẩn bị dữ liệu
cho phiên demo. Xem [giới hạn gói Free](https://render.com/docs/free) và
[hướng dẫn Docker trên Render](https://render.com/docs/docker).
