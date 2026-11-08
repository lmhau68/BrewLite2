'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, fetchProductDetail } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { ProductDetail as ProductDetailType } from '@/lib/types';
import { ErrorState } from '@/components/error-state';
import { ProductDetailFallback } from '@/components/product-detail-fallback';

interface ProductDetailProps {
  productId: string;
}

type Status = 'loading' | 'success' | 'error';

/**
 * Màn hình chi tiết món: mô tả, size, topping hỗ trợ và giá (FR-02).
 *
 * Chọn size/topping mới là phạm vi Sprint 2 (FR-02 đầy đủ). Ở Sprint 1 màn
 * hình này hiển thị đầy đủ dữ liệu tùy chọn để kiểm chứng API trả đúng.
 */
export function ProductDetail({ productId }: ProductDetailProps) {
  const [product, setProduct] = useState<ProductDetailType | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setStatus('loading');
      setErrorMessage('');

      try {
        const data = await fetchProductDetail(productId, signal);

        setProduct(data);
        setStatus('success');
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : 'Đã xảy ra lỗi khi tải chi tiết món.',
        );
        setStatus('error');
      }
    },
    [productId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load, reloadToken]);

  if (status === 'error') {
    return (
      <main className="page">
        <Link href="/" className="back-link">
          ← Quay lại menu
        </Link>

        <ErrorState
          message={errorMessage}
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      </main>
    );
  }

  if (status === 'loading' || !product) {
    return <ProductDetailFallback />;
  }

  return (
    <main className="page">
      <Link href="/" className="back-link">
        ← Quay lại menu
      </Link>

      <article className="detail">
        <div className="detail__media">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} />
          ) : (
            <span aria-hidden="true">☕</span>
          )}
        </div>

        <div className="detail__body">
          <p className="detail__category">{product.category}</p>
          <h1 className="detail__name">{product.name}</h1>

          {product.description ? (
            <p className="detail__description">{product.description}</p>
          ) : null}

          <p className="detail__price">{formatPrice(product.basePrice)}</p>

          {product.isAvailable ? null : (
            <p className="card__tag detail__tag">Hết hàng</p>
          )}

          <section className="detail__section" aria-labelledby="sizes-heading">
            <h2 className="detail__section-title" id="sizes-heading">
              Kích thước
            </h2>

            {product.sizes.length === 0 ? (
              <p className="detail__empty">Món này không có tùy chọn kích thước.</p>
            ) : (
              <ul className="options">
                {product.sizes.map((size) => (
                  <li className="option" key={size.id}>
                    <span className="option__name">{size.sizeName}</span>
                    <span className="option__price">
                      {size.price === 0
                        ? 'Miễn phí'
                        : `+ ${formatPrice(size.price)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="detail__section" aria-labelledby="toppings-heading">
            <h2 className="detail__section-title" id="toppings-heading">
              Tùy chọn thêm
            </h2>

            {product.toppings.length === 0 ? (
              <p className="detail__empty">Món này không có tùy chọn topping.</p>
            ) : (
              <ul className="options">
                {product.toppings.map((topping) => (
                  <li className="option" key={topping.id}>
                    <span className="option__name">{topping.name}</span>
                    <span className="option__price">
                      + {formatPrice(topping.price)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </article>
    </main>
  );
}
