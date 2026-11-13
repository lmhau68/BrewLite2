import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentScreen } from '@/components/payment-screen';
import {
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
    submitPayment: vi.fn(),
  };
});

const mockedFetchOrder = vi.mocked(fetchOrder);
const mockedFetchPayment = vi.mocked(fetchPayment);
const mockedSubmitPayment = vi.mocked(submitPayment);
const mockedGetAccessToken = vi.mocked(getAccessToken);

const ORDER_ID = '00000000-0000-4000-8000-000000000001';

describe('PaymentScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('starts on VNPay and creates a sandbox checkout only after the user requests it', async () => {
    mockedSubmitPayment.mockResolvedValue({
      id: 'payment-vnpay',
      orderId: ORDER_ID,
      amount: 42000,
      method: 'VNPAY',
      status: 'PENDING',
      transactionId: 'VNPAY_TEST_TX',
      bankCode: null,
      maskedAccount: null,
      checkoutUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1',
      orderStatus: 'PENDING',
      createdAt: '2026-01-01T00:01:00.000Z',
    });
    const user = userEvent.setup();

    render(<PaymentScreen orderId={ORDER_ID} />);

    await screen.findByText('BL-TEST1234');
    expect(
      screen.getByRole('button', { name: 'Tạo giao dịch VNPay Sandbox' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Ví điện tử (QR)')).not.toBeInTheDocument();
    expect(screen.queryByText('Thẻ / Ngân hàng')).not.toBeInTheDocument();
    expect(mockedSubmitPayment).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Tạo giao dịch VNPay Sandbox' }));
    expect(screen.queryByRole('img', { name: /qr/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Tiếp tục thanh toán trên VNPay Sandbox' }))
      .toHaveAttribute('href', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1');
    expect(mockedSubmitPayment).toHaveBeenCalledWith(
      { orderId: ORDER_ID, method: 'VNPAY' },
      expect.any(String),
    );
    expect(mocks.removePurchased).not.toHaveBeenCalled();
  });

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
          method: 'VNPAY',
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
          method: 'VNPAY',
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
