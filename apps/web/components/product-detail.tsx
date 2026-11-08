'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
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
 * Màn hình chi tiết món: chọn cấu hình và thêm món vào giỏ (FR-02, FR-03).
 */
export function ProductDetail({ productId }: ProductDetailProps) {
  const { addItem } = useCart();
  const [product, setProduct] = useState<ProductDetailType | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedSizeId, setSelectedSizeId] = useState('');
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([]);
  const [quantityInput, setQuantityInput] = useState('1');
  const [cartMessage, setCartMessage] = useState('');
  const [selectionError, setSelectionError] = useState('');

  const load = useCallback(
    async (signal: AbortSignal) => {
      setStatus('loading');
      setErrorMessage('');

      try {
        const data = await fetchProductDetail(productId, signal);

        setProduct(data);
        setSelectedSizeId(data.sizes[0]?.id ?? '');
        setSelectedToppingIds([]);
        setQuantityInput('1');
        setCartMessage('');
        setSelectionError('');
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

  const selectedSize = product?.sizes.find(
    (size) => size.id === selectedSizeId,
  );
  const selectedToppings =
    product?.toppings.filter((topping) =>
      selectedToppingIds.includes(topping.id),
    ) ?? [];
  const quantity = Number(quantityInput);
  const unitPrice =
    (product?.basePrice ?? 0) +
    (selectedSize?.price ?? 0) +
    selectedToppings.reduce((total, topping) => total + topping.price, 0);

  function addToCart() {
    if (!product) return;
    if (product.sizes.length > 0 && !selectedSize) {
      setSelectionError('Vui lòng chọn kích thước.');
      return;
    }
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99 ||
      quantity > product.stockQuantity
    ) {
      setSelectionError('Số lượng phải từ 1 đến tồn kho hiện tại (tối đa 99).');
      return;
    }
    if (selectedToppings.some((topping) => topping.stockQuantity < quantity)) {
      setSelectionError('Một topping đã chọn không đủ tồn kho.');
      return;
    }

    addItem({
      productId: product.id,
      productName: product.name,
      sizeId: selectedSize?.id ?? null,
      sizeName: selectedSize?.sizeName ?? null,
      toppings: selectedToppings.map(({ id, name, price }) => ({
        id,
        name,
        price,
      })),
      quantity,
      unitPrice,
    });
    setSelectionError('');
    setCartMessage(`${quantity} ${product.name} đã được thêm vào giỏ hàng.`);
  }

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
                    <label className="option__choice">
                      <input
                        type="radio"
                        name="product-size"
                        value={size.id}
                        checked={selectedSizeId === size.id}
                        onChange={() => {
                          setSelectedSizeId(size.id);
                          setCartMessage('');
                        }}
                        aria-label={`Size ${size.sizeName}`}
                      />
                      <span className="option__name">{size.sizeName}</span>
                      <span className="option__price">
                        {size.price === 0
                          ? 'Miễn phí'
                          : `+ ${formatPrice(size.price)}`}
                      </span>
                    </label>
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
                    <label className="option__choice">
                      <input
                        type="checkbox"
                        checked={selectedToppingIds.includes(topping.id)}
                        disabled={!product.isAvailable || topping.stockQuantity < 1}
                        onChange={(event) => {
                          setSelectedToppingIds((current) =>
                            event.target.checked
                              ? [...current, topping.id]
                              : current.filter((id) => id !== topping.id),
                          );
                          setCartMessage('');
                        }}
                        aria-label={topping.name}
                      />
                      <span className="option__name">{topping.name}</span>
                      <span className="option__price">
                        + {formatPrice(topping.price)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="detail__checkout" aria-label="Thêm vào giỏ hàng">
            <label className="field detail__quantity">
              <span className="field__label">Số lượng</span>
              <input
                type="number"
                min={1}
                max={Math.min(99, product.stockQuantity)}
                step={1}
                value={quantityInput}
                onChange={(event) => {
                  setQuantityInput(event.target.value);
                  setCartMessage('');
                  setSelectionError('');
                }}
              />
            </label>
            <p className="detail__total">
              Đơn giá: <strong>{formatPrice(unitPrice)}</strong>
            </p>
            {selectionError ? (
              <p className="notice notice--error" role="alert">
                {selectionError}
              </p>
            ) : null}
            {cartMessage ? (
              <p className="notice" role="status">{cartMessage}</p>
            ) : null}
            <button
              type="button"
              className="button"
              disabled={
                !product.isAvailable ||
                product.stockQuantity < 1 ||
                !Number.isInteger(quantity) ||
                quantity < 1 ||
                quantity > 99 ||
                quantity > product.stockQuantity ||
                (product.sizes.length > 0 && !selectedSize)
              }
              onClick={addToCart}
            >
              {product.isAvailable ? 'Thêm vào giỏ hàng' : 'Món đang hết hàng'}
            </button>
          </section>
        </div>
      </article>
    </main>
  );
}
