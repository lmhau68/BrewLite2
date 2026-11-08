import { formatPrice } from '@/lib/format';
import type { Product } from '@/lib/types';

interface MenuCardProps {
  product: Product;
}

/**
 * Thẻ hiển thị một món trong menu (FR-01).
 *
 * Giá hiển thị là giá cơ bản; giá chốt sau khi chọn size/topping do máy chủ
 * tính trong luồng đặt đơn (FR-07, BR-01).
 */
export function MenuCard({ product }: MenuCardProps) {
  return (
    <li className="card">
      <div className="card__media" aria-hidden="true">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" loading="lazy" />
        ) : (
          '☕'
        )}
      </div>

      <div className="card__body">
        <h2 className="card__name">{product.name}</h2>

        {product.description ? (
          <p className="card__description">{product.description}</p>
        ) : null}

        <div className="card__footer">
          <span className="card__price">{formatPrice(product.basePrice)}</span>

          {product.isAvailable ? null : (
            <span className="card__tag">Hết hàng</span>
          )}
        </div>
      </div>
    </li>
  );
}
