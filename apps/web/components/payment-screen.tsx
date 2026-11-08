'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchOrder, fetchPayment, submitPayment } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import type { Order, PaymentRecord } from '@/lib/types';

const PROCESSED_PREFIX = 'brewlite-payment-cart-processed:';
const processedPayments = new Set<string>();
type Method = 'WALLET' | 'CARD';

interface PaymentScreenProps {
  orderId: string;
}

export function PaymentScreen({ orderId }: PaymentScreenProps) {
  const router = useRouter();
  const { lines, initialized: cartInitialized, removePurchased } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [method, setMethod] = useState<Method>('WALLET');
  const [bankCode, setBankCode] = useState('VCB');
  const [accountNumber, setAccountNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const syncPurchasedItems = useCallback(
    (completed: Pick<PaymentRecord, 'id' | 'status'>, purchasedItems: Order['items']) => {
      if (completed.status !== 'SUCCESS') return;
      if (!cartInitialized) return;
      const processedKey = `${PROCESSED_PREFIX}${completed.id}`;
      try {
        if (
          processedPayments.has(completed.id) ||
          window.sessionStorage.getItem(processedKey)
        ) return;
        const quantities = new Map<string, number>();
        for (const item of purchasedItems) {
          const toppingIds = item.toppings.map((topping) => topping.id).sort().join(',');
          const line = lines.find(
            (candidate) =>
              candidate.productId === item.productId &&
              candidate.sizeId === item.sizeId &&
              candidate.toppings.map((topping) => topping.id).sort().join(',') === toppingIds,
          );
          if (line) {
            quantities.set(
              line.id,
              (quantities.get(line.id) ?? 0) + item.quantity,
            );
          }
        }
        removePurchased(
          [...quantities].map(([lineId, quantity]) => ({ lineId, quantity })),
        );
        processedPayments.add(completed.id);
        try {
          window.sessionStorage.setItem(processedKey, 'true');
        } catch (storageError) {
          console.error('Unable to persist payment cart completion.', storageError);
        }
        setStatusMessage('Thanh toán thành công. Giỏ hàng đã được cập nhật.');
      } catch (cause) {
        console.error('Unable to apply purchased cart lines.', cause);
        setError('Thanh toán thành công nhưng không cập nhật được giỏ hàng.');
      }
    },
    [cartInitialized, lines, removePurchased],
  );

  const loadOrder = useCallback(async () => {
    if (!getAccessToken()) {
      router.replace(`/login?next=/checkout/payment/${orderId}`);
      setLoading(false);
      return;
    }
    setError('');
    try {
      const currentOrder = await fetchOrder(orderId);
      setOrder(currentOrder);
      const payments = currentOrder.payments ?? [];
      const pendingPayment = payments.find(
        (item) => item.status === 'PENDING',
      );
      if (pendingPayment) setPayment(pendingPayment);
      const successfulPayment = payments.find(
        (item) => item.status === 'SUCCESS',
      );
      if (successfulPayment) {
        setPayment(successfulPayment);
        syncPurchasedItems(successfulPayment, currentOrder.items);
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không tải được thông tin đơn hàng.',
      );
    } finally {
      setLoading(false);
    }
  }, [orderId, router, syncPurchasedItems]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  async function pay() {
    if (!order) return;
    setError('');
    setStatusMessage('');
    setSubmitting(true);
    try {
      const result = await submitPayment(
        {
          orderId,
          method,
          ...(method === 'CARD' ? { bankCode, accountNumber } : {}),
        },
        crypto.randomUUID(),
      );
      setPayment(result);
      setOrder((current) =>
        current ? { ...current, status: result.orderStatus } : current,
      );
      setAccountNumber('');
      if (result.status === 'SUCCESS') syncPurchasedItems(result, order.items);
      if (result.status === 'FAILED') {
        setStatusMessage('Thanh toán thất bại. Bạn có thể thử lại trên đơn này.');
      }
      if (result.status === 'PENDING') {
        setStatusMessage('Chưa xác định kết quả. Hãy tra cứu giao dịch trước khi thử lại.');
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không nhận được kết quả. Hãy tra cứu đơn trước khi gửi lại thanh toán.',
      );
      if (!(cause instanceof ApiError)) {
        try {
          const currentOrder = await fetchOrder(orderId);
          setOrder(currentOrder);
          const latestPayment = currentOrder.payments?.[0];
          if (latestPayment) setPayment(latestPayment);
        } catch {
          setStatusMessage(
            'Kết quả chưa xác định; không gửi giao dịch mới cho đến khi tra cứu được đơn.',
          );
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function checkStatus() {
    if (!payment) {
      await loadOrder();
      return;
    }
    setError('');
    try {
      const result = await fetchPayment(payment.id);
      setPayment(result);
      setOrder((current) =>
        current ? { ...current, status: result.orderStatus } : current,
      );
      if (result.status === 'SUCCESS' && order) {
        syncPurchasedItems(result, order.items);
      }
      if (result.status === 'FAILED') {
        setStatusMessage('Giao dịch thất bại xác định. Bạn có thể thử lại.');
      }
      if (result.status === 'PENDING') {
        setStatusMessage('Giao dịch vẫn đang được xác minh. Vui lòng tra cứu lại sau.');
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không tra cứu được giao dịch. Vui lòng thử lại.',
      );
    }
  }

  if (loading) {
    return <main className="page"><section className="panel">Đang tải đơn hàng...</section></main>;
  }

  if (error && !order) {
    return (
      <main className="page">
        <p className="notice notice--error" role="alert">{error}</p>
        <Link href="/orders">Đến lịch sử đơn hàng</Link>
      </main>
    );
  }

  if (!order) return null;

  const qrValue = JSON.stringify({
    provider: 'BREWLITE_MOCK_WALLET',
    orderId: order.id,
    orderCode: order.orderCode,
    amount: order.totalAmount,
    currency: 'VND',
  });
  const canPay =
    (order.status === 'PENDING' || order.status === 'PAYMENT_FAILED') &&
    payment?.status !== 'PENDING';

  return (
    <main className="page">
      <header className="header">
        <h1 className="header__title">Thanh toán mô phỏng</h1>
        <p className="header__subtitle">Đơn {order.orderCode}</p>
      </header>
      <section className="panel payment-summary">
        <p>Mã đơn: <strong>{order.orderCode}</strong></p>
        <p>Tổng tiền: <strong>{formatPrice(order.totalAmount)}</strong></p>
        <p>Trạng thái đơn: <strong>{order.status}</strong></p>
      </section>

      {canPay ? (
        <section className="panel">
          <div className="payment-tabs" role="tablist" aria-label="Phương thức thanh toán">
            <button
              type="button"
              role="tab"
              aria-selected={method === 'WALLET'}
              className={method === 'WALLET' ? 'payment-tabs__item is-active' : 'payment-tabs__item'}
              onClick={() => setMethod('WALLET')}
            >
              Ví điện tử (QR)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={method === 'CARD'}
              className={method === 'CARD' ? 'payment-tabs__item is-active' : 'payment-tabs__item'}
              onClick={() => setMethod('CARD')}
            >
              Thẻ / Ngân hàng
            </button>
          </div>
          {method === 'WALLET' ? (
            <div className="qr-panel">
              <QRCodeSVG value={qrValue} size={192} level="M" includeMargin />
              <p>QR mô phỏng chứa mã đơn và số tiền.</p>
              <p className="muted">{order.orderCode} · {formatPrice(order.totalAmount)}</p>
            </div>
          ) : (
            <div className="form payment-form">
              <label className="field">
                <span className="field__label">Ngân hàng</span>
                <select value={bankCode} onChange={(event) => setBankCode(event.target.value)}>
                  <option value="VCB">Vietcombank (VCB)</option>
                  <option value="TCB">Techcombank (TCB)</option>
                  <option value="MB">MB Bank (MB)</option>
                  <option value="ACB">ACB Bank</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Số tài khoản / thẻ giả lập</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="9–12 chữ số bất kỳ"
                  maxLength={12}
                  value={accountNumber}
                  onChange={(event) =>
                    setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 12))
                  }
                />
              </label>
              <p className="muted">Chỉ số giả lập. Số tài khoản đầy đủ không được lưu.</p>
            </div>
          )}
          {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
          {statusMessage ? <p className="notice" role="status">{statusMessage}</p> : null}
          <button
            type="button"
            className="button payment-submit"
            disabled={
              submitting ||
              !canPay ||
              (method === 'CARD' && !/^\d{9,12}$/.test(accountNumber))
            }
            onClick={pay}
          >
            {submitting ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
          </button>
        </section>
      ) : (
        <section className="panel">
          <p>
            {payment?.status === 'SUCCESS'
              ? 'Thanh toán thành công.'
              : payment?.status === 'PENDING'
                ? 'Giao dịch đang được xác minh; chưa thể gửi thêm thanh toán.'
                : 'Đơn hàng không còn ở trạng thái chờ thanh toán.'}
          </p>
          {payment?.status === 'PENDING' ? (
            <button className="button" type="button" onClick={checkStatus}>
              Tra cứu giao dịch
            </button>
          ) : null}
          <Link className="button button--link" href={`/orders/${order.id}`}>
            Xem chi tiết đơn
          </Link>
        </section>
      )}
      {payment?.status === 'PENDING' ? (
        <button className="button button--secondary" type="button" onClick={checkStatus}>
          Tra cứu kết quả thanh toán
        </button>
      ) : null}
      <p className="muted payment-disclaimer">
        Đây là luồng thử nghiệm nội bộ, không kết nối ngân hàng và không xử lý tiền thật.
      </p>
    </main>
  );
}
