'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  fetchOrder,
  fetchPayment,
  submitPayment,
} from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import type { Order, PaymentRecord } from '@/lib/types';

const PROCESSED_PREFIX = 'brewlite-payment-cart-processed:';
const processedPayments = new Set<string>();

interface PaymentScreenProps {
  orderId: string;
}

export function PaymentScreen({ orderId }: PaymentScreenProps) {
  const router = useRouter();
  const { lines, initialized: cartInitialized, removePurchased } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
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
          window.localStorage.getItem(processedKey)
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
          window.localStorage.setItem(processedKey, 'true');
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

  const createVnpayPayment = useCallback(async () => {
    setError('');
    setStatusMessage('');
    setSubmitting(true);
    try {
      const result = await submitPayment(
        { orderId, method: 'VNPAY' },
        crypto.randomUUID(),
      );
      setPayment(result);
      setOrder((current) =>
        current ? { ...current, status: result.orderStatus } : current,
      );
      setStatusMessage(
        'Đã tạo giao dịch VNPay Sandbox. Tiếp tục sang cổng thanh toán để hoàn tất.',
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể tạo giao dịch VNPay. Vui lòng thử lại.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [orderId]);

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
      if (pendingPayment) {
        setPayment(await fetchPayment(pendingPayment.id));
      } else {
        const successfulPayment = payments.find(
          (item) => item.status === 'SUCCESS',
        );
        if (successfulPayment) {
          setPayment(successfulPayment);
          syncPurchasedItems(successfulPayment, currentOrder.items);
        } else {
          const latestPayment = payments[0];
          if (latestPayment?.status === 'FAILED') {
            setPayment(latestPayment);
          }
        }
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

  useEffect(() => {
    if (payment?.status !== 'PENDING') return;
    let active = true;
    const pendingPayment = payment;
    const purchasedItems = order?.items;
    const timer = window.setInterval(() => {
      void fetchPayment(pendingPayment.id)
        .then((result) => {
          if (!active) return;
          setPayment(result);
          setOrder((current) =>
            current && current.status !== result.orderStatus
              ? { ...current, status: result.orderStatus }
              : current,
          );
          if (result.status === 'SUCCESS' && purchasedItems) {
            syncPurchasedItems(result, purchasedItems);
          } else if (result.status === 'FAILED') {
            setStatusMessage('Thanh toán thất bại. Bạn có thể tạo giao dịch mới để thử lại.');
          }
        })
        .catch((cause) => {
          if (!active) return;
          setError(
            cause instanceof ApiError
              ? cause.message
              : 'Không thể tự làm mới trạng thái thanh toán.',
          );
        });
    }, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [order?.items, payment?.id, payment?.status, syncPurchasedItems]);

  async function pay() {
    if (!order) return;
    await createVnpayPayment();
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
        setStatusMessage(
          'Giao dịch vẫn đang chờ xác nhận. Tra cứu trạng thái không tự xác nhận thanh toán.',
        );
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

  const canPay =
    (order.status === 'PENDING' || order.status === 'PAYMENT_FAILED') &&
    payment?.status !== 'PENDING';

  return (
    <main className="page">
      <header className="header">
        <h1 className="header__title">Thanh toán đơn hàng</h1>
        <p className="header__subtitle">Đơn {order.orderCode}</p>
      </header>
      <section className="panel payment-summary">
        <p>Mã đơn: <strong>{order.orderCode}</strong></p>
        <p>Tổng tiền: <strong>{formatPrice(order.totalAmount)}</strong></p>
        <p>Trạng thái đơn: <strong>{order.status}</strong></p>
      </section>

      {canPay ? (
        <section className="panel">
          <div className="qr-panel">
            <p>
              Thanh toán thử nghiệm qua cổng VNPay. Giao dịch sandbox không
              trừ tiền thật.
            </p>
            <p className="muted">
              Sau khi tạo giao dịch, bạn sẽ tiếp tục tại trang thanh toán VNPay.
              Nếu sandbox cung cấp VNPAY-QR, mã QR sẽ hiển thị trên trang đó.
            </p>
            <p className="muted">{order.orderCode} · {formatPrice(order.totalAmount)}</p>
          </div>
          {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
          {statusMessage ? <p className="notice" role="status">{statusMessage}</p> : null}
          <button
            type="button"
            className="button payment-submit"
            disabled={submitting || !canPay}
            onClick={pay}
          >
            {submitting ? 'Đang xử lý...' : 'Tạo giao dịch VNPay Sandbox'}
          </button>
        </section>
      ) : (
        <section className="panel">
          <p>
            {payment?.status === 'SUCCESS'
              ? 'Thanh toán thành công.'
              : payment?.status === 'PENDING'
                ? payment.method === 'VNPAY'
                  ? 'Đang chờ VNPay xác nhận. Trạng thái đơn sẽ tự cập nhật sau khi cổng gửi kết quả.'
                  : 'Giao dịch được tạo bằng phương thức cũ. Hãy tra cứu trạng thái hoặc liên hệ người quản lý nếu vẫn đang chờ.'
                : 'Đơn hàng không còn ở trạng thái chờ thanh toán.'}
          </p>
          {statusMessage ? <p className="notice" role="status">{statusMessage}</p> : null}
          {payment?.status === 'PENDING' ? (
            <>
              {payment.method === 'VNPAY' ? (
                <div className="qr-panel">
                  {payment.checkoutUrl ? (
                    <a className="button" href={payment.checkoutUrl}>
                      Tiếp tục thanh toán trên VNPay Sandbox
                    </a>
                  ) : (
                    <p className="notice notice--error" role="alert">
                      Không tìm thấy liên kết VNPay cho giao dịch này.
                    </p>
                  )}
                  <p className="muted">
                    Chỉ trạng thái IPN đã được backend xác minh mới xác nhận đơn hàng.
                  </p>
                </div>
              ) : (
                <p className="notice notice--error" role="alert">
                  Không thể tiếp tục giao dịch cũ bằng phương thức mô phỏng. Nếu giao dịch
                  đã được thanh toán, hãy tra cứu trạng thái đơn hàng.
                </p>
              )}
              <button className="button button--secondary" type="button" onClick={checkStatus}>
                Tra cứu trạng thái giao dịch
              </button>
            </>
          ) : null}
          <Link className="button button--link" href={`/orders/${order.id}`}>
            Xem chi tiết đơn
          </Link>
        </section>
      )}
      <p className="muted payment-disclaimer">
        VNPay Sandbox dùng dữ liệu kiểm thử, không xử lý tiền thật.
      </p>
    </main>
  );
}
