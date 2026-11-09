'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchOrders } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setOrders(await fetchOrders());
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không tải được lịch sử đơn hàng.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getAccessToken()) void load();
    else {
      setError('Đăng nhập để xem lịch sử đơn hàng.');
      setLoading(false);
    }
  }, [load]);

  return (
    <main className="page">
      <header className="header">
        <h1 className="header__title">Đơn hàng của tôi</h1>
        <p className="header__subtitle">Lịch sử và trạng thái các đơn đã đặt.</p>
      </header>
      {loading ? <section className="panel">Đang tải...</section> : null}
      {error ? (
        <section className="panel">
          <p className="notice notice--error" role="alert">{error}</p>
          {getAccessToken() ? (
            <button type="button" className="button" onClick={() => void load()}>
              Thử lại
            </button>
          ) : <Link href="/login?next=/orders">Đăng nhập</Link>}
        </section>
      ) : null}
      {!loading && !error && orders.length === 0 ? (
        <section className="panel">
          <p>Bạn chưa có đơn hàng nào.</p>
          <Link className="button button--link" href="/">Xem menu</Link>
        </section>
      ) : null}
      <ul className="order-list">
        {orders.map((order) => (
          <li className="panel order-card" key={order.id}>
            <div className="order-card__top">
              <h2>{order.orderCode}</h2>
              <strong>{STATUS_LABELS[order.status]}</strong>
            </div>
            <p>{new Date(order.createdAt).toLocaleString('vi-VN')}</p>
            <p>{order.items.reduce((sum, item) => sum + item.quantity, 0)} món</p>
            <p className="order-card__price">{formatPrice(order.totalAmount)}</p>
            <Link href={`/orders/${order.id}`}>Xem chi tiết</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
