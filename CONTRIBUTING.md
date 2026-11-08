# Quy Định Đóng Góp (Contributing Guidelines) - Team BrewLite

Chào mừng mọi người đến với repository của dự án BrewLite! Để đảm bảo source code sạch sẽ, hạn chế conflict lúc nửa đêm và pass môn Công nghệ Phần mềm rực rỡ, toàn team **BẮT BUỘC** tuân thủ các quy tắc dưới đây.

---

## 1. Chiến Lược Phân Nhánh (Branching Strategy)

Dự án áp dụng mô hình GitHub Flow rút gọn. Chúng ta có các loại nhánh sau:

- **`main`**: Nhánh THẦN THÁNH. Chỉ chứa code đã test kỹ, chạy ổn định và sẵn sàng deploy/bảo vệ. **TUYỆT ĐỐI KHÔNG PUSH TRỰC TIẾP VÀO MAIN**.
- **`dev`**: Nhánh tích hợp chính. Anh em gom tính năng mới vào đây để chạy thử nghiệm cùng nhau.
- **`feature/<tên-chức-năng>`**: Nhánh làm việc cá nhân. Khi nhận task mới, hãy rẽ nhánh từ `dev` ra. 
  - *Ví dụ:* `feature/menu-api`, `feature/cart-ui`, `feature/payment-mock`.

---

## 2. Quy Trình Làm Việc & Pull Request (PR)

Khi code xong một task ở nhánh `feature/`, muốn gom vào `dev` (hoặc từ `dev` lên `main`), anh em phải mở Pull Request (PR) trên GitHub.

### Tiêu chuẩn một Pull Request "Ngon":
1. **Tiêu đề (Title):** Phải rõ ràng, có tiền tố. 
   - *Cú pháp:* `[Phân hệ] - Tên task` (VD: `[WEB] - Hoàn thiện giao diện Menu`, `[API] - Thêm endpoint POST /orders`).
2. **Nội dung (Description):** Mô tả ngắn gọn PR này làm gì. Gắn thẻ Task ID (ví dụ: `Resolve #12`). Nếu làm UI, **bắt buộc** đính kèm ảnh chụp màn hình.

### Quy tắc Merge Code (Luật Bất Thành Văn):
1. **Qua ải CI (Continuous Integration):** Pipeline GitHub Actions (`ci.yml`) phải báo tích xanh 🟢 (Pass toàn bộ Lint, Build, Unit Test). Nếu báo đỏ 🔴, tác giả tự về sửa, cấm bấm Merge.
2. **Có người Review:** Phải có ít nhất **1 thành viên khác** trong team vào xem code, thả comment và nhấn nút **Approve**. (Scrum Master sẽ ưu tiên kiểm duyệt phần này).
3. **Dọn rác:** Merge xong PR thì nhớ check vào ô tự động xóa nhánh `feature/` đó để repo luôn gọn gàng.

---

## 3. Quy Ước Commit (Commit Convention)

Dự án áp dụng chuẩn **Conventional Commits**. Hệ thống phải có lịch sử gọn gàng, chuyên nghiệp để dễ dàng truy vết (Traceability) và chấm điểm. TUYỆT ĐỐI KHÔNG commit rác kiểu: `"fix"`, `"xong"`, `"test"`.

**Cú pháp chuẩn:** `loại_commit(phạm_vi_tùy_chọn): [Mã Task] - Mô tả ngắn gọn`

*   **`feat:`** Thêm tính năng/endpoint mới (VD: `feat(api): [#BL-05] Thêm endpoint GET /products`).
*   **`fix:`** Sửa một lỗi/bug (VD: `fix(web): [#BL-06] Sửa lỗi vỡ UI giỏ hàng trên điện thoại`).
*   **`docs:`** Cập nhật tài liệu, README, sơ đồ UML (VD: `docs: Cập nhật sơ đồ Deployment cho Task 3.2`).
*   **`refactor:`** Viết lại/tối ưu code cho sạch đẹp mà không làm thay đổi logic (VD: `refactor(api): Tối ưu hóa vòng lặp tính tổng tiền`).
*   **`test:`** Thêm hoặc sửa Unit/Integration Test (VD: `test(api): Thêm unit test cho hàm trừ tồn kho`).
*   **`chore:`** Các công việc linh tinh: cấu hình build, CI/CD, cài thư viện (VD: `chore: Thêm thư viện nestjs-pino cho logging`).

---

## 4. Định Nghĩa "Hoàn Thành" (Definition of Done - DoD)

Trong tinh thần Agile/Scrum, một task KHÔNG ĐƯỢC coi là "Xong" nếu nó chỉ mới "chạy được trên máy tui". Một Issue chỉ chính thức được kéo sang cột **Done** khi thỏa mãn TẤT CẢ 5 điều kiện "thép" sau:

1.  **Code chạy mượt ở Local:** Đã tự test kỹ lưỡng qua Docker Compose (`docker compose up`) trên máy cá nhân mà không văng lỗi sảng.
2.  **Vượt ải CI Pipeline (Xanh 🟢):** GitHub Actions đã chạy thành công 100% các bước: Install, Lint, Unit Test, Build. Không có bất kỳ cảnh báo (warning) hay lỗi (error) nào.
3.  **Code Review & Approved:** Đã mở Pull Request (PR) và được ít nhất **1 thành viên khác** (ưu tiên Scrum Master) soi code, review logic và nhấn nút **Approve**.
4.  **Tài liệu (Docs) đồng bộ:** Nếu task có làm thay đổi đến kiến trúc, database, hoặc luồng xử lý, BẮT BUỘC phải cập nhật lại tài liệu UML/ADR tương ứng để giữ tính truy vết.
5.  **Dọn dẹp chiến trường:** PR đã được Merge thành công vào nhánh `dev` hoặc `main`, và nhánh `feature/*` chứa code nháp của cá nhân đã được xóa sạch sẽ.

---

## 5. Quy Định Về Tài Liệu (Docs)
- Toàn bộ sơ đồ UML, ADRs, và Requirement Specs phải đặt trong thư mục `docs/`.
- Thay đổi kiến trúc hay sơ đồ phải mở PR và ghi rõ lý do. Hệ thống phải đảm bảo tính **Truy vết (Traceability)** giữa hình vẽ và code.

Mọi người đọc kỹ và tuân thủ nhé. Happy Coding! 