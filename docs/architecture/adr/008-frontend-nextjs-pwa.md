# ADR-008: Frontend Next.js mobile-first/PWA, giỏ hàng phía client

| Trạng thái | Ngày | Người đề xuất |
|---|---|---|
| Accepted | 05/11/2026 | Nhóm phát triển |

## Bối cảnh
Khách đặt đồ uống chủ yếu trên điện thoại (NFR-05). Next.js bắt buộc theo đề bài và hướng mobile-first/PWA. Cần quyết định mức PWA, nơi giữ giỏ hàng và cách frontend gọi backend.

## Quyết định
- **Next.js (App Router) + TypeScript**, thiết kế mobile-first (viewport 360×800 và 390×844).
- **Giỏ hàng giữ ở client** (state + `localStorage`); API tính lại giá và tồn kho khi tạo đơn.
- Frontend gọi **COMP-API trực tiếp qua HTTPS + JWT**; không dùng Next.js API Routes cho nghiệp vụ (nghiệp vụ nằm ở NestJS, theo ADR-002).
- **PWA mức tối thiểu:** có `manifest`. **Service Worker và cache menu offline là mở rộng (NFR-10, Could).**
- Chạy dạng **container Node** (SSR/SSG), `NEXT_PUBLIC_API_URL` nhúng lúc build.

## Lý do (ưu điểm)
- Giỏ ở client: không cần bảng/giao diện giỏ ở server, giảm phạm vi MVP (FR-03, FR-04 chỉ cần phía client).
- Gọi API trực tiếp giữ ranh giới rõ: frontend chỉ hiển thị, backend giữ nghiệp vụ.
- PWA tối thiểu giảm rủi ro thời gian nhưng vẫn đúng hướng đề bài.

## Hạn chế và đánh đổi
- Giỏ không đồng bộ giữa thiết bị; mất khi xóa dữ liệu trình duyệt. Chấp nhận trong MVP.
- Gọi API từ trình duyệt cần cấu hình CORS (`CORS_ORIGIN`).
- Đổi URL API phải build lại image (do `NEXT_PUBLIC_*`).
- Service Worker làm tăng độ phức tạp và rủi ro cache cũ, nên để mở rộng.

## Phương án đã loại
| Phương án | Lý do loại |
|---|---|
| Giỏ hàng lưu ở server | Thêm bảng, endpoint và đồng bộ; không cần cho MVP |
| Xuất tĩnh (`next export`) lên CDN thuần | Mất SSR; vẫn khả thi nếu nhóm chọn nền tảng tĩnh, ghi ở mục 13 `architecture.md` |
| Native app | Ngoài phạm vi (OS-03) |

## Hệ quả cho Task 3.2
COMP-WEB là một container Node riêng, nằm sau CDN/HTTPS của nền tảng, gọi COMP-API qua HTTPS.
Yêu cầu: FR-01…04, NFR-05, NFR-10.
