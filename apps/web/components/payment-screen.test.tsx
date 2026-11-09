import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentScreen } from '@/components/payment-screen';
import {
  cancelQrPayment,
  fetchOrder,
  fetchPayment,
  submitPayment,
} from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  removePurchased: vi.fn(),
  cartInitialized: true,
  lines: [] as Array<{
    id: string;
    productId: string;
    sizeId: string | null;
    toppings: Array<{ id: string }>;
  }>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
}));

vi.mock('@/lib/auth', () => ({
  getAccessToken: vi.fn(),
}));

vi.mock('@/lib/cart', () => ({
  useCart: () => ({
    lines: mocks.lines,
    initialized: mocks.cartInitialized,
    removePurchased: mocks.removePurchased,
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    fetchOrder: vi.fn(),
    fetchPayment: vi.fn(),
    cancelQrPayment: vi.fn(),
    submitPayment: vi.fn(),
  };
});

const mockedFetchOrder = vi.mocked(fetchOrder);
const mockedFetchPayment = vi.mocked(fetchPayment);
const mockedCancelQrPayment = vi.mocked(cancelQrPayment);
const mockedSubmitPayment = vi.mocked(submitPayment);
const mockedGetAccessToken = vi.mocked(getAccessToken);

const ORDER_ID = '00000000-0000-4000-8000-000000000001';

describe('PaymentScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCancelQrPayment.mockResolvedValue({
      id: 'payment-qr',
      orderId: ORDER_ID,
      amount: 42000,
      method: 'WALLET',
      status: 'FAILED',
      transactionId: 'MOCK_TX_QR',
      bankCode: null,
      maskedAccount: null,
      qrScanToken: null,
      orderStatus: 'PENDING',
      createdAt: '2026-01-01T00:01:00.000Z',
    });
    mocks.cartInitialized = true;
    mocks.lines = [
      {
        id: 'cart-line-1',
        productId: 'product-1',
        sizeId: 'size-m',
        toppings: [],
      },
    ];
    mockedGetAccessToken.mockReturnValue('test-token');
    mockedFetchOrder.mockResolvedValue({
      id: ORDER_ID,
      orderCode: 'BL-TEST1234',
      status: 'PENDING',
      totalAmount: 42000,
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          productName: 'Bạc Xỉu',
          sizeId: 'size-m',
          sizeName: 'M',
          toppings: [],
          quantity: 1,
          unitPrice: 42000,
          subtotal: 42000,
        },
      ],
      payments: [],
    });
  });

  it('submits the selected mock bank and account, then shows the confirmed result', async () => {
    const user = userEvent.setup();
    mockedSubmitPayment
      .mockResolvedValueOnce({
        id: 'payment-qr',
        orderId: ORDER_ID,
        amount: 42000,
        method: 'WALLET',
        status: 'PENDING',
        transactionId: 'MOCK_TX_QR',
        bankCode: null,
        maskedAccount: null,
        qrScanToken: 'qr-token',
        orderStatus: 'PENDING',
        createdAt: '2026-01-01T00:01:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'payment-1',
        orderId: ORDER_ID,
        amount: 42000,
        method: 'CARD',
        status: 'SUCCESS',
        transactionId: 'MOCK_TX_1',
        bankCode: 'MB',
        maskedAccount: '****9012',
        orderStatus: 'PAID',
        createdAt: '2026-01-01T00:01:00.000Z',
      });

    render(<PaymentScreen orderId={ORDER_ID} />);
    await screen.findByText('BL-TEST1234');
    await user.click(await screen.findByRole('button', { name: 'Hủy QR và chọn thẻ' }));
    await user.click(screen.getByRole('tab', { name: 'Thẻ / Ngân hàng' }));
    await user.selectOptions(screen.getByLabelText('Ngân hàng'), 'MB');
    await user.type(
      screen.getByLabelText('Số tài khoản / thẻ giả lập'),
      '123456789012',
    );
    await user.click(
      screen.getByRole('button', { name: 'Xác nhận thanh toán' }),
    );

    await waitFor(() => {
      expect(mockedSubmitPayment).toHaveBeenLastCalledWith(
        {
          orderId: ORDER_ID,
          method: 'CARD',
          bankCode: 'MB',
          accountNumber: '123456789012',
        },
        expect.any(String),
      );
    });
    expect(await screen.findByText('Thanh toán thành công.')).toBeInTheDocument();
    expect(screen.queryByText('****9012')).not.toBeInTheDocument();
    expect(screen.getByText(/không xử lý tiền thật/)).toBeInTheDocument();
    expect(mocks.removePurchased).toHaveBeenCalledWith([
      { lineId: 'cart-line-1', quantity: 1 },
    ]);
  });

  it('does not remove cart items when a mock payment fails', async () => {
    const user = userEvent.setup();
    mockedSubmitPayment
      .mockResolvedValueOnce({
        id: 'payment-qr',
        orderId: ORDER_ID,
        amount: 42000,
        method: 'WALLET',
        status: 'PENDING',
        transactionId: 'MOCK_TX_QR',
        bankCode: null,
        maskedAccount: null,
        qrScanToken: 'qr-token',
        orderStatus: 'PENDING',
        createdAt: '2026-01-01T00:01:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'payment-failed',
        orderId: ORDER_ID,
        amount: 42000,
        method: 'CARD',
        status: 'FAILED',
        transactionId: 'MOCK_TX_FAILED',
        bankCode: 'VCB',
        maskedAccount: '****9012',
        orderStatus: 'PAYMENT_FAILED',
        createdAt: '2026-01-01T00:01:00.000Z',
      });

    render(<PaymentScreen orderId={ORDER_ID} />);
    await screen.findByText('BL-TEST1234');
    await user.click(await screen.findByRole('button', { name: 'Hủy QR và chọn thẻ' }));
    await user.click(screen.getByRole('tab', { name: 'Thẻ / Ngân hàng' }));
    await user.type(
      screen.getByLabelText('Số tài khoản / thẻ giả lập'),
      '123456789012',
    );
    await user.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
    expect(
      await screen.findByText('Thanh toán thất bại. Bạn có thể thử lại trên đơn này.'),
    ).toBeInTheDocument();
    expect(mocks.removePurchased).not.toHaveBeenCalled();
  });

  it('automatically creates and displays a pending QR payment for a new order', async () => {
    mockedSubmitPayment.mockResolvedValue({
      id: 'payment-auto-qr',
      orderId: ORDER_ID,
      amount: 42000,
      method: 'WALLET',
      status: 'PENDING',
      transactionId: 'MOCK_TX_QR',
      bankCode: null,
      maskedAccount: null,
      qrScanToken: 'qr-token',
      orderStatus: 'PENDING',
      createdAt: '2026-01-01T00:01:00.000Z',
    });
    render(<PaymentScreen orderId={ORDER_ID} />);

    await screen.findByText('BL-TEST1234');
    expect(await screen.findByText(/Dùng camera điện thoại quét mã/)).toBeInTheDocument();
    expect(screen.getByText(/Đang chờ quét QR/)).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeInTheDocument();
    expect(
      screen.getAllByRole('status').filter((element) =>
        element.textContent?.includes('Mã QR đã sẵn sàng'),
      ),
    ).toHaveLength(1);
    expect(mockedSubmitPayment).toHaveBeenCalledWith(
      { orderId: ORDER_ID, method: 'WALLET' },
      expect.any(String),
    );
    expect(mocks.removePurchased).not.toHaveBeenCalled();
  });

  it('updates order and cart automatically when the phone scan succeeds', async () => {
    mockedSubmitPayment.mockResolvedValue({
      id: 'payment-qr',
      orderId: ORDER_ID,
      amount: 42000,
      method: 'WALLET',
      status: 'PENDING',
      transactionId: 'MOCK_TX_QR',
      bankCode: null,
      maskedAccount: null,
      qrScanToken: 'qr-token',
      orderStatus: 'PENDING',
      createdAt: '2026-01-01T00:01:00.000Z',
    });
    mockedFetchPayment.mockResolvedValue({
      id: 'payment-qr',
      orderId: ORDER_ID,
      amount: 42000,
      method: 'WALLET',
      status: 'SUCCESS',
      transactionId: 'MOCK_TX_QR',
      bankCode: null,
      maskedAccount: null,
      orderStatus: 'PAID',
      createdAt: '2026-01-01T00:01:00.000Z',
    });

    render(<PaymentScreen orderId={ORDER_ID} />);
    await screen.findByText('BL-TEST1234');
    expect(mocks.removePurchased).not.toHaveBeenCalled();

    expect(
      await screen.findByText(
        'Thanh toán thành công. Giỏ hàng đã được cập nhật.',
        {},
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(mocks.removePurchased).toHaveBeenCalledWith([
      { lineId: 'cart-line-1', quantity: 1 },
    ]);
  }, 10000);

  it('waits for cart hydration before marking a successful payment as processed', async () => {
    mocks.cartInitialized = false;
    mockedFetchOrder.mockResolvedValue({
      id: ORDER_ID,
      orderCode: 'BL-TEST1234',
      status: 'PAID',
      totalAmount: 42000,
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [],
      payments: [
        {
          id: 'existing-payment',
          amount: 42000,
          method: 'WALLET',
          status: 'SUCCESS',
          transactionId: 'MOCK_TX_2',
          bankCode: null,
          maskedAccount: null,
          createdAt: '2026-01-01T00:01:00.000Z',
        },
      ],
    });

    const view = render(<PaymentScreen orderId={ORDER_ID} />);
    await screen.findByText('BL-TEST1234');
    expect(mocks.removePurchased).not.toHaveBeenCalled();

    mocks.cartInitialized = true;
    view.rerender(<PaymentScreen orderId={ORDER_ID} />);
    await waitFor(() => {
      expect(mocks.removePurchased).toHaveBeenCalledWith([]);
    });
  });

  it('does not remove a purchased cart quantity twice after browser storage restores payment state', async () => {
    const paymentId = 'payment-already-synced';
    window.localStorage.setItem(
      `brewlite-payment-cart-processed:${paymentId}`,
      'true',
    );
    mockedFetchOrder.mockResolvedValue({
      id: ORDER_ID,
      orderCode: 'BL-TEST1234',
      status: 'PAID',
      totalAmount: 42000,
      createdAt: '2026-01-01T00:00:00.000Z',
      items: [],
      payments: [
        {
          id: paymentId,
          amount: 42000,
          method: 'WALLET',
          status: 'SUCCESS',
          transactionId: 'MOCK_TX_RESTORED',
          bankCode: null,
          maskedAccount: null,
          createdAt: '2026-01-01T00:01:00.000Z',
        },
      ],
    });

    render(<PaymentScreen orderId={ORDER_ID} />);

    expect(await screen.findByText('BL-TEST1234')).toBeInTheDocument();
    expect(mocks.removePurchased).not.toHaveBeenCalled();
  });
});
