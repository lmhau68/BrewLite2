'use client';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
}

/**
 * Trạng thái lỗi tải menu, kèm nút thử lại (FR-01).
 */
export function ErrorState({ message, onRetry, isRetrying }: ErrorStateProps) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon" aria-hidden="true">
        ⚠️
      </span>
      <h2 className="state__title">Không tải được menu</h2>
      <p className="state__description">{message}</p>
      <button
        type="button"
        className="button"
        onClick={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? 'Đang thử lại…' : 'Thử lại'}
      </button>
    </div>
  );
}
