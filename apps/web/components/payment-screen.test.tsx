import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentScreen } from '@/components/payment-screen';
import { fetchOrder, submitPayment } from '@/lib/api';
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
    submitPayment: vi.fn(),
  };
});

const mockedFetchOrder = vi.mocked(fetchOrder);
const mockedSubmitPayment = vi.mocked(submitPayment);
const mockedGetAccessToken = vi.mocked(getAccessToken);

const ORDER_ID = '00000000-0000-4000-8000-000000000001';

describe('PaymentScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cartInitialized = true;
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
    mockedSubmitPayment.mockResolvedValue({
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
      expect(mockedSubmitPayment).toHaveBeenCalledWith(
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
  });

  it('shows a QR payment option by default', async () => {
    render(<PaymentScreen orderId={ORDER_ID} />);

    expect(await screen.findByText(/QR mô phỏng chứa mã đơn/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ví điện tử (QR)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
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
});
