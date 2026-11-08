/**
 * Khung chờ hiển thị trong lúc route `/products/[id]` đang được render.
 */
export function ProductDetailFallback() {
  return (
    <main className="page">
      <span className="back-link">← Quay lại menu</span>

      <div className="detail" aria-busy="true">
        <div className="detail__media detail__media--skeleton" />
        <div className="detail__body">
          <div className="skeleton__line" />
          <div className="skeleton__line skeleton__line--medium" />
          <div className="skeleton__line skeleton__line--short" />
        </div>
      </div>
    </main>
  );
}
