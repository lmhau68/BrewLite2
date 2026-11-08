interface EmptyStateProps {
  message?: string;
}

/**
 * Trạng thái danh sách rỗng: danh mục được chọn không có món nào (FR-01).
 */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="state">
      <span className="state__icon" aria-hidden="true">
        🥤
      </span>
      <h2 className="state__title">Chưa có món nào</h2>
      <p className="state__description">
        {message ?? 'Danh mục này hiện chưa có sản phẩm. Hãy thử danh mục khác.'}
      </p>
    </div>
  );
}
