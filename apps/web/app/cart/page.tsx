'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, createOrder } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';

const ORDER_KEY_STORAGE = 'brewlite-order-idempotency';

export default function CartPage() {
  const router = useRouter();
  const { lines, itemCount, totalAmount, updateQuantity, removeItem } = useCart();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderAttempt, setOrderAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);

  async function checkout() {
    setError('');
    if (!getAccessToken()) {
      router.push('/login?next=/cart');
      return;
    }
    if (lines.length === 0) {
      setError('Giỏ hàng đang trống.');
      return;
    }
    setLoading(true);
    try {
      const fingerprint = JSON.stringify(
        lines.map((line) => ({
          productId: line.productId,
          sizeId: line.sizeId,
          toppingIds: line.toppings.map((topping) => topping.id).sort(),
          quantity: line.quantity,
        })),
      );
      let idempotencyKey =
        orderAttempt?.fingerprint === fingerprint ? orderAttempt.key : '';
      try {
        const saved = window.sessionStorage.getItem(ORDER_KEY_STORAGE);
        const parsed: unknown = saved ? JSON.parse(saved) : null;
        if (!idempotencyKey && (
          parsed &&
          typeof parsed === 'object' &&
          'fingerprint' in parsed &&
          parsed.fingerprint === fingerprint &&
          'key' in parsed &&
          typeof parsed.key === 'string'
        )) {
          idempotencyKey = parsed.key;
        }
      } catch (storageError) {
        console.error('Unable to restore order idempotency key.', storageError);
      }
      if (!idempotencyKey) idempotencyKey = crypto.randomUUID();
      const attempt = { fingerprint, key: idempotencyKey };
      setOrderAttempt(attempt);
      try {
        window.sessionStorage.setItem(ORDER_KEY_STORAGE, JSON.stringify(attempt));
      } catch (storageError) {
        console.error('Unable to persist order idempotency key.', storageError);
      }
      const order = await createOrder(
        lines.map((line) => ({
          productId: line.productId,
          sizeId: line.sizeId ?? undefined,
          toppingIds: line.toppings.map((topping) => topping.id),
          quantity: line.quantity,
        })),
        idempotencyKey,
      );
      setOrderAttempt(null);
      try {
        window.sessionStorage.removeItem(ORDER_KEY_STORAGE);
      } catch (storageError) {
        console.error('Unable to clear completed order idempotency key.', storageError);
      }
      router.push(`/checkout/payment/${order.id}`);
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể tạo đơn hàng. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="header">
        <h1 className="header__title">Giỏ hàng</h1>
        <p className="header__subtitle">{itemCount} món</p>
      </header>
      {lines.length === 0 ? (
        <section className="panel">
          <p>Giỏ hàng của bạn đang trống.</p>
          <Link className="button button--link" href="/">Xem menu</Link>
        </section>
      ) : (
        <>
          <ul className="cart-list">
            {lines.map((line) => (
              <li className="panel cart-line" key={line.id}>
                <div>
                  <h2 className="cart-line__name">{line.productName}</h2>
                  <p className="muted">
                    {[line.sizeName, ...line.toppings.map((topping) => topping.name)]
                      .filter(Boolean)
                      .join(' · ') || 'Mặc định'}
                  </p>
                  <p>{formatPrice(line.unitPrice)} / món</p>
                </div>
                <div className="cart-line__actions">
                  <label className="field field--compact">
                    <span className="field__label">Số lượng</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={line.quantity}
                      onChange={(event) =>
                        updateQuantity(line.id, Number(event.target.value))
                      }
                    />
                  </label>
                  <strong>{formatPrice(line.unitPrice * line.quantity)}</strong>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => removeItem(line.id)}
                  >
                    Xóa
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <section className="panel cart-total">
            <p>Tổng cộng <strong>{formatPrice(totalAmount)}</strong></p>
            <button type="button" className="button" onClick={checkout} disabled={loading}>
              {loading ? 'Đang tạo đơn...' : 'Đặt hàng và thanh toán'}
            </button>
          </section>
        </>
      )}
      {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
    </main>
  );
}
