'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError, simulateQrPayment } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import type { PaymentSummary } from '@/lib/types';

type ScanState = 'loading' | 'success' | 'failed' | 'pending' | 'error';

export default function MockQrScanPage() {
  const [state, setState] = useState<ScanState>('loading');
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const paymentId = params.get('paymentId');
    const scanToken = params.get('token');
    if (!paymentId || !scanToken) {
      setState('error');
      setMessage('Liên kết QR không hợp lệ.');
      return;
    }

    void simulateQrPayment(paymentId, scanToken)
      .then((result) => {
        setPayment(result);
        setState(
          result.status === 'SUCCESS'
            ? 'success'
            : result.status === 'FAILED'
              ? 'failed'
              : 'pending',
        );
      })
      .catch((cause: unknown) => {
        setState('error');
        setMessage(
          cause instanceof ApiError
            ? cause.message
            : 'Không kết nối được máy chủ để xác nhận QR.',
        );
      });
  }, []);

  return (
    <main className="page">
      <section className="panel">
        <h1 className="header__title">Thanh toán QR BrewLite</h1>
        {state === 'loading' ? <p>Đang xác nhận giao dịch...</p> : null}
        {state === 'success' && payment ? (
          <>
            <p role="status">Thanh toán thành công.</p>
            <p>Mã giao dịch: {payment.transactionId}</p>
            <p>Số tiền: {formatPrice(payment.amount)}</p>
            <p>Bạn có thể quay lại trang thanh toán trên máy tính.</p>
          </>
        ) : null}
        {state === 'failed' && payment ? (
          <>
            <p role="alert">Giao dịch thanh toán thất bại.</p>
            <p>Số tiền chưa được ghi nhận là đã thanh toán.</p>
          </>
        ) : null}
        {state === 'pending' && payment ? (
          <>
            <p role="status">Chưa xác định được kết quả; giao dịch vẫn đang chờ.</p>
            <p>Số tiền: {formatPrice(payment.amount)}</p>
            <p>Hãy quay lại trang thanh toán trên máy tính và quét lại sau.</p>
          </>
        ) : null}
        {state === 'error' ? <p role="alert">{message}</p> : null}
        <p className="muted">
          Đây là xác nhận mô phỏng, không kết nối ngân hàng và không chuyển tiền thật.
        </p>
      </section>
    </main>
  );
}
