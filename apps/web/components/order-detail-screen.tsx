'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchOrder } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { Order } from '@/lib/types';

const STATUS_LABELS: Record<Order['status'], string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  PAYMENT_FAILED: 'Thanh toán thất bại',
  PREPARING: 'Đang pha chế',
  READY: 'Sẵn sàng nhận',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

export function OrderDetailScreen({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setOrder(await fetchOrder(orderId));
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không tải được thông tin đơn hàng.',
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <Link href="/orders" className="back-link">← Lịch sử đơn hàng</Link>
      <header className="header">
        <h1 className="header__title">Chi tiết đơn hàng</h1>
      </header>
      {loading ? <section className="panel">Đang tải...</section> : null}
      {error ? (
        <section className="panel">
          <p className="notice notice--error" role="alert">{error}</p>
          <button type="button" className="button" onClick={() => void load()}>
            Làm mới
          </button>
        </section>
      ) : null}
      {order ? (
        <>
          <section className="panel order-detail">
            <div className="order-card__top">
              <h2>{order.orderCode}</h2>
              <strong>{STATUS_LABELS[order.status]}</strong>
            </div>
            <p>Đặt lúc: {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
            <ul className="order-items">
              {order.items.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.productName} × {item.quantity}</strong>
                    <p className="muted">
                      {[item.sizeName, ...item.toppings.map((topping) => topping.name)]
                        .filter(Boolean)
                        .join(' · ') || 'Mặc định'}
                    </p>
                    <p className="muted">{formatPrice(item.unitPrice)} / món</p>
                  </div>
                  <strong>{formatPrice(item.subtotal)}</strong>
                </li>
              ))}
            </ul>
            <p className="cart-total">Tổng cộng <strong>{formatPrice(order.totalAmount)}</strong></p>
            <h2 className="detail__section-title">Giao dịch thanh toán</h2>
            {order.payments?.length ? (
              <ul className="order-items">
                {order.payments.map((payment) => (
                  <li key={payment.id}>
                    <span>
                      {payment.method === 'VNPAY'
                        ? 'VNPay Sandbox'
                        : 'Phương thức thanh toán cũ'}
                      {' · '}{payment.status}
                    </span>
                    <strong>{formatPrice(payment.amount)}</strong>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">Chưa có giao dịch.</p>}
            <button type="button" className="button button--secondary" onClick={() => void load()}>
              Làm mới trạng thái
            </button>
          </section>
          {order.status === 'PENDING' || order.status === 'PAYMENT_FAILED' ? (
            <Link className="button button--link" href={`/checkout/payment/${order.id}`}>
              Tiếp tục thanh toán
            </Link>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
