'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchStaffOrders, updateStaffOrder } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: 'CANCELLED',
  PAYMENT_FAILED: 'CANCELLED',
  PAID: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
};

export default function StaffOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setOrders(await fetchStaffOrders());
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không tải được danh sách đơn tại quầy.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function advance(order: Order, status: OrderStatus) {
    setSavingId(order.id);
    setError('');
    try {
      const updated = await updateStaffOrder(order.id, status);
      setOrders((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Không thể cập nhật trạng thái đơn.',
      );
    } finally {
      setSavingId('');
    }
  }

  return (
    <main className="page">
      <header className="header">
        <h1 className="header__title">Quản lý đơn tại quầy</h1>
        <p className="header__subtitle">Chỉ nhân viên và quản lý được phép cập nhật.</p>
      </header>
      {error ? (
        <section className="panel">
          <p className="notice notice--error" role="alert">{error}</p>
          <button type="button" className="button" onClick={() => void load()}>Thử lại</button>
        </section>
      ) : null}
      {loading ? <section className="panel">Đang tải...</section> : null}
      {!loading && !error && orders.length === 0 ? (
        <section className="panel">Chưa có đơn hàng.</section>
      ) : null}
      <ul className="order-list">
        {orders.map((order) => {
          const next = NEXT_STATUS[order.status];
          return (
            <li className="panel order-card" key={order.id}>
              <div className="order-card__top">
                <h2>{order.orderCode}</h2>
                <strong>{order.status}</strong>
              </div>
              <p>{order.customer?.fullName} · {order.customer?.email}</p>
              <p>{formatPrice(order.totalAmount)}</p>
              {next ? (
                <button
                  type="button"
                  className="button"
                  disabled={savingId === order.id}
                  onClick={() => void advance(order, next)}
                >
                  {savingId === order.id ? 'Đang cập nhật...' : `Chuyển sang ${next}`}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
