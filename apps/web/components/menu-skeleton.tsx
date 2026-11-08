/**
 * Khung xương (skeleton) hiển thị trong lúc chờ dữ liệu menu (FR-01).
 *
 * Giữ đúng chiều cao với thẻ món thật để trang không nhảy khi dữ liệu tới.
 */
export function MenuSkeleton() {
  return (
    <ul className="menu" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <li className="skeleton" key={index}>
          <div className="skeleton__media" />
          <div className="skeleton__body">
            <div className="skeleton__line" />
            <div className="skeleton__line skeleton__line--medium" />
            <div className="skeleton__line skeleton__line--short" />
          </div>
        </li>
      ))}
    </ul>
  );
}
