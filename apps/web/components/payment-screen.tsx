'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  cancelQrPayment,
  fetchOrder,
  fetchPayment,
  simulateCardPaymentResult,
  submitPayment,
} from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { getPhoneReachableOrigin } from '@/lib/phone-origin';
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
  const [browserOrigin, setBrowserOrigin] = useState('');
  const autoQrOrderId = useRef<string | null>(null);

  useEffect(() => {
    setBrowserOrigin(window.location.origin);
  }, []);

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

  const createQrPayment = useCallback(async () => {
    setError('');
    setStatusMessage('');
    setSubmitting(true);
    try {
      const result = await submitPayment(
        { orderId, method: 'WALLET' },
        crypto.randomUUID(),
      );
      setPayment(result);
      setOrder((current) =>
        current ? { ...current, status: result.orderStatus } : current,
      );
      setStatusMessage(
        'Mã QR đã sẵn sàng. Chỉ khi điện thoại quét và mở liên kết, giao dịch mới được xác nhận.',
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể tạo giao dịch QR. Vui lòng thử lại.',
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
            setMethod(latestPayment.method);
          } else if (
            (currentOrder.status === 'PENDING' ||
              currentOrder.status === 'PAYMENT_FAILED') &&
            autoQrOrderId.current !== currentOrder.id
          ) {
            setPayment(null);
            setMethod('WALLET');
            autoQrOrderId.current = currentOrder.id;
            void createQrPayment();
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
  }, [createQrPayment, orderId, router, syncPurchasedItems]);

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
    if (method === 'WALLET') {
      await createQrPayment();
      return;
    }
    setError('');
    setStatusMessage('');
    setSubmitting(true);
    try {
      const result = await submitPayment(
        {
          orderId,
          method: 'CARD',
          bankCode,
          accountNumber,
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
        setStatusMessage(
          'Chưa xác định kết quả. Hãy tra cứu giao dịch trước khi thử lại.',
        );
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

  async function cancelQr() {
    if (!payment) return;
    setError('');
    setStatusMessage('');
    setSubmitting(true);
    try {
      const result = await cancelQrPayment(payment.id);
      setPayment(result);
      setMethod('CARD');
      setStatusMessage('Đã hủy giao dịch QR. Bạn có thể chọn thanh toán thẻ.');
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể hủy giao dịch QR. Vui lòng tra cứu lại trạng thái.',
      );
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

  async function simulateCardResult() {
    if (!payment) return;
    setError('');
    setStatusMessage('');
    setSubmitting(true);
    try {
      const result = await simulateCardPaymentResult(payment.id);
      setPayment(result);
      setOrder((current) =>
        current ? { ...current, status: result.orderStatus } : current,
      );
      if (result.status === 'SUCCESS' && order) {
        syncPurchasedItems(result, order.items);
      } else if (result.status === 'FAILED') {
        setStatusMessage('Thanh toán thất bại. Bạn có thể tạo giao dịch mới để thử lại.');
      } else {
        setStatusMessage(
          'Kết quả chưa xác định; giao dịch vẫn chờ. Hãy tra cứu lại hoặc thử mô phỏng xác nhận sau.',
        );
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không xác nhận được giao dịch mô phỏng. Vui lòng thử lại.',
      );
    } finally {
      setSubmitting(false);
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

  let qrValue = '';
  if (browserOrigin && payment?.method === 'WALLET' && payment.qrScanToken) {
    const scanUrl = new URL(
      '/mock-payment/scan',
      getPhoneReachableOrigin(browserOrigin),
    );
    scanUrl.hash = new URLSearchParams({
      paymentId: payment.id,
      token: payment.qrScanToken,
    }).toString();
    qrValue = scanUrl.toString();
  }
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
              disabled={submitting}
            >
              Ví điện tử (QR)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={method === 'CARD'}
              className={method === 'CARD' ? 'payment-tabs__item is-active' : 'payment-tabs__item'}
              onClick={() => setMethod('CARD')}
              disabled={submitting}
            >
              Thẻ / Ngân hàng
            </button>
          </div>
          {method === 'WALLET' ? (
            <div className="qr-panel">
              <p>
                {submitting
                  ? 'Đang tạo mã QR để quét bằng điện thoại...'
                  : 'Mã QR sẽ sẵn sàng ngay khi tạo giao dịch.'}
              </p>
              <p className="muted">Giao dịch chỉ thành công sau khi điện thoại mở liên kết QR.</p>
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
            {submitting
              ? 'Đang xử lý...'
              : method === 'WALLET'
                ? payment?.status === 'FAILED'
                  ? 'Tạo giao dịch QR mới'
                  : 'Thử tạo lại mã QR'
                : 'Xác nhận thanh toán'}
          </button>
        </section>
      ) : (
        <section className="panel">
          <p>
            {payment?.status === 'SUCCESS'
              ? 'Thanh toán thành công.'
              : payment?.status === 'PENDING'
                ? payment.method === 'WALLET'
                  ? 'Đang chờ quét QR. Khi điện thoại mở liên kết, trạng thái sẽ tự cập nhật.'
                  : 'Giao dịch đang được xác minh; chưa thể gửi thêm thanh toán.'
                : 'Đơn hàng không còn ở trạng thái chờ thanh toán.'}
          </p>
          {statusMessage ? <p className="notice" role="status">{statusMessage}</p> : null}
          {payment?.status === 'PENDING' ? (
            <>
              {payment.method === 'WALLET' ? (
                <div className="qr-panel">
                  {qrValue ? (
                    <QRCodeSVG value={qrValue} size={192} level="M" includeMargin />
                  ) : (
                    <p>Đang tạo mã QR để quét bằng điện thoại...</p>
                  )}
                  <p>
                    Dùng camera điện thoại quét mã và mở liên kết. Trang này sẽ tự
                    cập nhật khi điện thoại xác nhận.
                  </p>
                  <p className="muted">
                    QR mô phỏng, không kết nối ứng dụng ngân hàng và không nhận tiền thật.
                  </p>
                  {error ? <p className="notice notice--error" role="alert">{error}</p> : null}
                </div>
              ) : (
                <button
                  className="button"
                  type="button"
                  disabled={submitting}
                  onClick={simulateCardResult}
                >
                  {submitting
                    ? 'Đang xác nhận...'
                    : 'Mô phỏng nhận kết quả ngân hàng'}
                </button>
              )}
              {payment.method === 'WALLET' ? (
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={submitting}
                  onClick={cancelQr}
                >
                  {submitting ? 'Đang xử lý...' : 'Hủy QR và chọn thẻ'}
                </button>
              ) : null}
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
        Đây là luồng thử nghiệm nội bộ, không kết nối ngân hàng và không xử lý tiền thật.
      </p>
    </main>
  );
}
