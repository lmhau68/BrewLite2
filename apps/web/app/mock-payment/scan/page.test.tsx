import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MockQrScanPage from './page';
import { simulateQrPayment } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  },
  simulateQrPayment: vi.fn(),
}));

const mockedSimulateQrPayment = vi.mocked(simulateQrPayment);

describe('MockQrScanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(
      {},
      '',
      '/mock-payment/scan#paymentId=payment-1&token=scan-token',
    );
  });

  it('confirms the QR scan and shows successful payment on the phone', async () => {
    mockedSimulateQrPayment.mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      amount: 25000,
      method: 'WALLET',
      status: 'SUCCESS',
      transactionId: 'MOCK_TX_1',
      bankCode: null,
      maskedAccount: null,
      qrScanToken: null,
      orderStatus: 'PAID',
      createdAt: '2026-01-01T00:01:00.000Z',
    });

    render(<MockQrScanPage />);

    expect(await screen.findByText('Thanh toán thành công.')).toBeInTheDocument();
    expect(mockedSimulateQrPayment).toHaveBeenCalledWith(
      'payment-1',
      'scan-token',
    );
  });

  it('does not show success when the QR outcome failed', async () => {
    mockedSimulateQrPayment.mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      amount: 25000,
      method: 'WALLET',
      status: 'FAILED',
      transactionId: 'MOCK_TX_1',
      bankCode: null,
      maskedAccount: null,
      qrScanToken: null,
      orderStatus: 'PAYMENT_FAILED',
      createdAt: '2026-01-01T00:01:00.000Z',
    });

    render(<MockQrScanPage />);

    expect(await screen.findByText('Giao dịch thanh toán thất bại.')).toBeInTheDocument();
    expect(screen.queryByText('Thanh toán thành công.')).not.toBeInTheDocument();
  });
});
