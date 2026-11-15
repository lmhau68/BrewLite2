# ☕ BrewLite - Hệ thống Đặt Đồ Uống Trực Tuyến

**BrewLite** là ứng dụng đặt đồ uống được thiết kế theo mô hình MVP (Minimum Viable Product) với giao diện tối ưu hóa cho trải nghiệm di động (Mobile-first). Dự án tập trung giải quyết bài toán vận hành khép kín cho cửa hàng cà phê, đảm bảo tính nhất quán dữ liệu từ khâu chọn món đến khi hoàn tất thanh toán.

**🔄 Luồng nghiệp vụ cốt lõi:**
`Xem menu` ➔ `Chọn tùy chọn (Size/Topping)` ➔ `Giỏ hàng` ➔ `Đặt đơn` ➔ `Thanh toán (Mô phỏng Ví/Thẻ)` ➔ `Theo dõi trạng thái đơn`

---

## 🚀 Liên kết Hệ thống (Production)

Hệ thống đã được thiết lập quy trình CI/CD tự động và triển khai thực tế trên môi trường đám mây. Giảng viên và người dùng có thể trải nghiệm trực tiếp thông qua các liên kết dưới đây:

*   **🌐 Ứng dụng khách hàng (Frontend):** https://brewlite-web-it8r.onrender.com/
*   **⚙️ Backend API:** https://brewlite-api-7lrv.onrender.com/products
*   **🩺 Trạng thái hệ thống (Health Check):** https://brewlite-api-7lrv.onrender.com/health
*   **🎬 Video Demo End-to-End:** https://drive.google.com/file/d/1-AcWuSa6Wunitsy0PQdm1sVDx2k6svJY/view?usp=sharing

> **⚠️ Lưu ý vận hành:** Hệ thống backend đang chạy trên nền tảng đám mây gói miễn phí (Free Tier). Nếu không có yêu cầu nào trong vòng 15 phút, máy chủ sẽ tự động tạm ngưng (spin-down). Lần truy cập đầu tiên sau khoảng thời gian này có thể mất từ 30 - 50 giây để khởi động lại dịch vụ. Các thao tác sau đó sẽ diễn ra với tốc độ bình thường.

## 🛠 Ngăn xếp Công nghệ (Technology Stack)

Hệ thống BrewLite được phát triển dựa trên nguyên lý thiết kế phân lớp (Layered Architecture), tách biệt hoàn toàn ranh giới giữa giao diện người dùng, logic xử lý nghiệp vụ và tầng lưu trữ dữ liệu để đảm bảo khả năng mở rộng (Scalability) và dễ dàng bảo trì.

### 1. Frontend (Tương tác người dùng)
- **Framework:** Next.js 16 (App Router)
- **Ngôn ngữ:** TypeScript
- **Đặc điểm:** Xây dựng theo phương pháp Mobile-first và kiến trúc PWA (Progressive Web App). Giao tiếp với Backend thông qua các lệnh gọi API RESTful (JSON) qua giao thức HTTP/HTTPS.

### 2. Backend (Xử lý nghiệp vụ cốt lõi)
- **Framework:** NestJS 12
- **Ngôn ngữ:** TypeScript
- **ORM (Object-Relational Mapping):** TypeORM 0.3
- **Đặc điểm:** Thiết kế theo kiến trúc Modular Monolith. Kiểm soát nghiêm ngặt các giao dịch cơ sở dữ liệu (Database Transactions) và tính lũy đẳng (Idempotency) để xử lý an toàn các truy cập đồng thời (Concurrency/Race Condition) trong luồng thanh toán và trừ tồn kho.

### 3. Cơ sở dữ liệu (Database)
- **Hệ quản trị:** PostgreSQL 16
- **Khởi tạo & Quản lý:** Tự động hóa quá trình tái tạo cấu trúc (Migration) và nạp dữ liệu mẫu (Seed). Kịch bản Seed được thiết kế với tính chất Idempotent (có thể chạy lại nhiều lần mà không gây trùng lặp dữ liệu), đảm bảo tính nhất quán trên mọi môi trường triển khai.

### 4. Vận hành, Mạng & CI/CD (DevOps & Infrastructure)
- **Containerization & Network Isolation:** Docker và Docker Compose. Toàn bộ các dịch vụ (Web, API, DB) được đóng gói thành các container độc lập và cô lập trong một mạng nội bộ ảo (Docker Bridge Network). Cơ sở dữ liệu được ẩn hoàn toàn khỏi mạng public để đảm bảo bảo mật.
- **Tích hợp liên tục (CI):** GitHub Actions. Pipeline tự động kích hoạt các bước kiểm định (Quality Gate): `Install` ➔ `Lint` ➔ `Unit/Integration/E2E Test` ➔ `Build` mỗi khi có Pull Request.
- **Phân phối liên tục (CD):** 
  - **Registry:** GitHub Container Registry (GHCR) lưu trữ các Docker Image được gắn tag theo mã SHA.
  - **Cloud Hosting:** Render Cloud. Hệ thống sử dụng Webhook để tự động kéo Image mới nhất về, cấu hình cổng mạng và tự động cấp phát chứng chỉ SSL/TLS để cung cấp URL truy cập qua giao thức HTTPS bảo mật.

  # 💻 Khởi chạy cục bộ (Local Development)

Dự án **BrewLite** hỗ trợ hai phương pháp khởi chạy trong môi trường
local. Để bảo đảm tính nhất quán của môi trường phát triển và giảm thiểu
tối đa các lỗi xung đột phần mềm, nhóm **khuyến nghị sử dụng Docker
Compose**.

## Phương pháp 1: Chạy bằng Docker Compose (Khuyến nghị)

Phương pháp này sử dụng **Containerization** để tự động hóa toàn bộ quá
trình thiết lập môi trường, bao gồm khởi tạo Database và nạp dữ liệu mẫu
(Seed) một cách độc lập.

### Yêu cầu môi trường

-   Đã cài đặt **Docker**.
-   Đã cài đặt **Docker Compose**.

### Bước 1: Thiết lập biến môi trường

Sao chép file cấu hình mẫu để hệ thống nhận diện các biến môi trường mặc
định:

``` bash
cp .env.example .env
```

### Bước 2: Khởi động hệ thống

Lưu ý: đảm bảo phần mềm Docker Desktop đang mở chạy nền trước khi thực thi lệnh.

Chạy lệnh sau tại thư mục gốc của dự án để Docker tự động tải image,
build và chạy các container ở chế độ nền (*detached mode*):

``` bash
docker compose up -d --build
```

### Bước 3: Truy cập hệ thống

Sau khi lệnh chạy hoàn tất và các dịch vụ báo trạng thái `Started`, bạn
có thể truy cập hệ thống thông qua các cổng đã được ánh xạ (*Port
Mapping*) ra `localhost`:

  -----------------------------------------------------------------------
  Thành phần                          Đường dẫn truy cập
  ----------------------------------- -----------------------------------
  Frontend (Giao diện Khách hàng)     <http://localhost:3000>

  Backend API (NestJS)                <http://localhost:3001>

  API Health Check (Kiểm tra trạng    <http://localhost:3001/health>
  thái)                               
  -----------------------------------------------------------------------

> **Lưu ý:** Quá trình tạo cấu trúc bảng (*Migration*) và nạp dữ liệu
> mẫu (*Seed*) sẽ được thực thi tự động ngay khi container API khởi động
> thành công.

### Các lệnh Docker hữu ích

**Xem log hệ thống để debug:**

``` bash
docker compose logs -f
```

**Dừng và gỡ bỏ các container (vẫn giữ lại dữ liệu trong volume):**

``` bash
docker compose down
```

**Dừng và xóa sạch toàn bộ container cùng dữ liệu trong volume:**

``` bash
docker compose down -v
```

> **Cảnh báo:** Lệnh `docker compose down -v` sẽ xóa các volume, đồng
> nghĩa với việc dữ liệu được lưu trong các volume đó cũng bị xóa.

------------------------------------------------------------------------

## Phương pháp 2: Chạy thủ công (Dành cho Coder)

Phương pháp này đòi hỏi cấu hình môi trường phức tạp hơn, phù hợp với
lập trình viên muốn can thiệp trực tiếp vào mã nguồn.

### Yêu cầu môi trường

-   **Node.js** phiên bản **20 trở lên**.
-   **PostgreSQL** phiên bản **16** đang hoạt động trên máy tính.

### Bước 1: Khởi chạy Backend API

Mở một terminal mới và chạy lần lượt các lệnh sau:

``` bash
cd apps/api

npm install

cp ../../.env.example .env
```

> **Lưu ý:** Cần chỉnh sửa các biến `POSTGRES_*` trong file `.env` nếu
> Database local của bạn không sử dụng cổng mặc định.

Tiếp tục chạy các lệnh sau:

``` bash
# Chạy script tạo cấu trúc bảng (Schema)
npm run migration:run

# Nạp dữ liệu mẫu (Idempotent - an toàn khi chạy nhiều lần)
npm run seed

# Khởi động server API ở chế độ Watch
npm run start:dev
```

Backend API sẽ chạy tại:

<http://localhost:3001>

### Bước 2: Khởi chạy Frontend Web

Mở một terminal khác và chạy lần lượt các lệnh sau:

``` bash
cd apps/web

npm install

npm run dev
```

Frontend Web sẽ chạy tại:

<http://localhost:3000>

## 🧪 Hướng dẫn Kiểm thử (Testing Guide)

Dự án BrewLite áp dụng phương pháp Kiểm định và Xác minh (V&V - Verification and Validation)[cite: 292] thông qua hệ thống kiểm thử tự động (Automated Test Framework) được chia thành ba cấp độ cốt lõi, tuân thủ nguyên tắc "Test-first" trong quy trình Agile[cite: 255]:

### 1. Kiểm thử Đơn vị (Unit Test)
*   **Mục tiêu:** Kiểm tra độc lập logic của từng hàm, từng component (ví dụ: công thức tính tổng tiền, logic chuyển trạng thái đơn hàng)[cite: 293].
*   **Thực thi:**
    ```bash
    # Chạy từ thư mục gốc hoặc thư mục apps/api, apps/web
    npm test
    ```

### 2. Kiểm thử Tích hợp (Integration Test) & Kiểm thử Toàn trình (End-to-End Test)
*   **Mục tiêu:**
    *   **Integration Test:** Kiểm tra sự giao tiếp giữa các thành phần hệ thống (API và Database), đặc biệt là các kịch bản hóc búa như **Race Condition** (kẹt tồn kho) và tính **Idempotency** (chống trừ tiền đúp).
    *   **E2E Test:** Mô phỏng kịch bản người dùng cuối (End-user) từ lúc xem menu, đặt hàng đến khi thanh toán thành công (Sử dụng Playwright cho Frontend)[cite: 103].
*   **Môi trường (Quan trọng):** Các bài test này yêu cầu sự cô lập môi trường (Environment Isolation) để không làm hỏng dữ liệu thật. Do đó, cần cấu hình biến `TEST_DATABASE_URL` trỏ vào một cơ sở dữ liệu PostgreSQL trống hoặc cơ sở dữ liệu dành riêng cho kiểm thử.
*   **Thực thi (tại `apps/api`):**
    ```bash
    # Thiết lập biến môi trường (Ví dụ trên PowerShell/Terminal)
    # (Thay thế URL tương ứng với môi trường của bạn)
    $env:TEST_DATABASE_URL="postgres://brewlite:brewlite@127.0.0.1:5432/brewlite_test"; 
    
    # Chạy kiểm thử
    npm run test:integration
    npm run test:e2e
    ```

### 3. Kiểm tra Tự động hóa trên CI (Continuous Integration - Task 4.4)
*   Toàn bộ các bài kiểm thử (Unit, Integration, E2E) đều được tích hợp vào pipeline GitHub Actions (`.github/workflows/ci.yml`)[cite: 103, 105].
*   Mọi Pull Request (PR) đều phải vượt qua 100% các bài test này (Quality Gate) trước khi được Merge vào nhánh `main` hoặc `dev`[cite: 105].

## ⚙️ Hướng dẫn CI/CD & Deploy 

Dự án áp dụng quy trình Tích hợp và Phân phối liên tục (CI/CD) thông qua **GitHub Actions** để tự động hóa hoàn toàn khâu kiểm định và triển khai lên môi trường Cloud, tuân thủ nguyên tắc "Không triển khai thủ công".

### 1. Luồng Tích hợp Liên tục (Continuous Integration - CI)
Mỗi khi có Pull Request (PR) hoặc commit mới đẩy lên nhánh `main` / `dev`, hệ thống tự động chạy Pipeline `.github/workflows/ci.yml` với các bước kiểm duyệt nghiêm ngặt (Quality Gate):
*   **Install:** Tự động cài đặt các dependency.
*   **Lint:** Kiểm tra chuẩn mực định dạng code (oxlint & Prettier).
*   **Unit & Integration Test:** Kích hoạt môi trường Database ảo trong Docker để chạy các bài test Backend. PR sẽ bị chặn (Block) nếu có bất kỳ bài test nào báo lỗi đỏ.
*   **Build:** Xác nhận mã nguồn biên dịch thành công.

### 2. Luồng Phân phối Liên tục (Continuous Deployment - CD)
Khi một PR được duyệt và **Merge vào nhánh `main`**, hệ thống tự động kích hoạt Pipeline `.github/workflows/cd.yml`:
1.  **Build & Push Image:** Đóng gói ứng dụng thành Docker Image, gắn tag theo mã commit (SHA) và đẩy lên **GitHub Container Registry (GHCR)**.
2.  **Deploy to Render:** GitHub gửi tín hiệu Webhook (Deploy Hook) sang nền tảng Render Cloud.
3.  **Tự động cập nhật:** Render tự động tải Image mới nhất từ GHCR về, chạy script Migration & Seed an toàn (không làm mất dữ liệu cũ), và khởi động lại Web Service.

### 3. Kiểm tra Sức khỏe & Kịch bản Rollback (Smoke Test & Rollback)
Để đảm bảo an toàn tuyệt đối khi đưa phiên bản mới lên Production:
*   **Smoke Test:** Ngay sau khi Deploy, Pipeline sẽ tự động gọi vào endpoint `GET /health` của API. Nếu API trả về mã HTTP 200 (OK), bản cập nhật được xác nhận thành công.
*   **Tự động Rollback:** Nếu Smoke Test thất bại (ví dụ: API trả về 503 do lỗi kết nối Database), Pipeline sẽ tự động gửi lệnh thông qua Render API để **lùi phiên bản (Rollback)** về bản Deploy hoạt động ổn định trước đó.

> **💡 Hướng dẫn Rollback thủ công:**
> Trong trường hợp hệ thống gặp sự cố nghiêm trọng không thể tự phục hồi, người quản trị có thể rollback bằng cách:
> 1. Đăng nhập vào Dashboard của Render.
> 2. Chọn dịch vụ Web Service tương ứng (Frontend hoặc API).
> 3. Chuyển sang tab **Deploys**.
> 4. Tìm bản cập nhật đang hoạt động ổn định ở quá khứ, nhấn nút **Rollback to this deploy**.

## 📂 Cấu trúc thư mục (Project Structure)

Dự án BrewLite được tổ chức theo kiến trúc **Monorepo** (ADR-001), giúp quản lý tập trung toàn bộ mã nguồn Frontend, Backend, tài liệu và cấu hình CI/CD trong một Repository duy nhất. Cấu trúc này tối ưu hóa việc chia sẻ mã, quản lý phiên bản và đồng bộ hóa quy trình triển khai.

```text
brewlite/
├── apps/                       # Chứa mã nguồn các ứng dụng cốt lõi
│   ├── api/                    # ⚙️ Backend NestJS (REST API)
│   │   ├── src/                
│   │   │   ├── config/         # Cấu hình kết nối Cơ sở dữ liệu (PostgreSQL)
│   │   │   ├── database/       # Thực thể (Entities), Migration và Seed data
│   │   │   └── modules/        # Các module nghiệp vụ (auth, products, orders, payments, health)
│   │   └── Dockerfile          # Cấu hình đóng gói Docker cho API
│   └── web/                    # 🌐 Frontend Next.js (App Router, PWA)
│       ├── app/                # Các trang (Pages) và Layout
│       ├── components/         # Các thành phần giao diện (UI Components) tái sử dụng
│       ├── lib/                # API client, xử lý dữ liệu, định dạng
│       ├── public/             # Tài nguyên tĩnh (Hình ảnh, icon, manifest PWA)
│       └── Dockerfile          # Cấu hình đóng gói Docker cho Web
├── docs/                       # 📚 Tài liệu Kỹ nghệ Phần mềm (SE Documentation)
│   ├── requirements/           # Đặc tả yêu cầu (SRS, Use-case)
│   ├── diagrams/               # Sơ đồ UML (Activity, Sequence, Class, Deployment)
│   ├── architecture/           # Tài liệu kiến trúc và Quyết định kiến trúc (ADRs)
│   └── traceability-matrix.md  # Ma trận truy vết (Traceability Matrix)
├── tests/                      # 🧪 Kịch bản kiểm thử (Integration & E2E Tests)
├── .github/workflows/          # 🤖 Cấu hình CI/CD Pipeline (GitHub Actions)
│   ├── ci.yml                  # Pipeline Tích hợp liên tục (Install, Lint, Test, Build)
│   └── cd.yml                  # Pipeline Phân phối liên tục (Build Image, Deploy Render)
├── docker-compose.yml          # Cấu hình triển khai cục bộ (Local Development)
├── .env.example                # Mẫu biến môi trường (KHÔNG chứa thông tin nhạy cảm)
└── README.md                   # Tài liệu hướng dẫn sử dụng dự án