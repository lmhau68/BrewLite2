import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuScreen } from '@/components/menu-screen';
import { ApiError, fetchProducts } from '@/lib/api';
import type { Product } from '@/lib/types';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();

  return { ...actual, fetchProducts: vi.fn() };
});

const mockedFetchProducts = vi.mocked(fetchProducts);

const buildProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'product-1',
  name: 'Bạc Xỉu Đá',
  description: 'Cà phê đen đá pha sẵn',
  basePrice: 25000,
  category: 'Cà phê',
  imageUrl: null,
  stockQuantity: 10,
  isAvailable: true,
  ...overrides,
});

describe('MenuScreen', () => {
  beforeEach(() => {
    mockedFetchProducts.mockReset();
  });

  it('hiển thị trạng thái đang tải khi chờ dữ liệu', () => {
    mockedFetchProducts.mockReturnValue(new Promise(() => undefined));

    const { container } = render(<MenuScreen />);

    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('hiển thị danh sách món khi tải thành công', async () => {
    mockedFetchProducts.mockResolvedValue([
      buildProduct(),
      buildProduct({
        id: 'product-2',
        name: 'Trà Đào',
        basePrice: 32000,
        category: 'Trà',
      }),
    ]);

    render(<MenuScreen />);

    expect(await screen.findByText('Bạc Xỉu Đá')).toBeInTheDocument();
    expect(screen.getByText('Trà Đào')).toBeInTheDocument();
    expect(screen.getByText('25.000 ₫')).toBeInTheDocument();
  });

  it('không hiển thị món đã hết hàng trong menu chính', async () => {
    mockedFetchProducts.mockResolvedValue([
      buildProduct(),
      buildProduct({
        id: 'product-2',
        name: 'Cà Phê Muống',
        isAvailable: false,
        stockQuantity: 0,
      }),
    ]);

    render(<MenuScreen />);

    expect(await screen.findByText('Bạc Xỉu Đá')).toBeInTheDocument();
    expect(screen.queryByText('Cà Phê Muống')).not.toBeInTheDocument();
  });

  it('hiển thị trạng thái rỗng khi danh mục không có món nào', async () => {
    mockedFetchProducts.mockResolvedValue([
      buildProduct({ id: 'p1', category: 'Cà phê đặc sản', isAvailable: false }),
    ]);

    render(<MenuScreen />);

    expect(await screen.findByText('Chưa có món nào')).toBeInTheDocument();
  });

  it('hiển thị trạng thái lỗi kèm nút thử lại khi API thất bại', async () => {
    mockedFetchProducts.mockRejectedValue(
      new ApiError('Không thể kết nối tới máy chủ.', 0),
    );

    render(<MenuScreen />);

    expect(await screen.findByText('Không tải được menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('gọi lại API khi nhấn nút thử lại', async () => {
    const user = userEvent.setup();

    mockedFetchProducts.mockRejectedValueOnce(
      new ApiError('Không thể kết nối tới máy chủ.', 0),
    );

    render(<MenuScreen />);

    const retryButton = await screen.findByRole('button', { name: 'Thử lại' });

    mockedFetchProducts.mockResolvedValue([buildProduct()]);

    await user.click(retryButton);

    expect(await screen.findByText('Bạc Xỉu Đá')).toBeInTheDocument();
    expect(mockedFetchProducts).toHaveBeenCalledTimes(2);
  });

  it('lọc theo danh mục khi chọn danh mục', async () => {
    const user = userEvent.setup();

    mockedFetchProducts.mockResolvedValue([
      buildProduct(),
      buildProduct({
        id: 'product-2',
        name: 'Trà Đào',
        category: 'Trà',
      }),
    ]);

    render(<MenuScreen />);

    await screen.findByText('Bạc Xỉu Đá');

    await user.click(screen.getByRole('button', { name: 'Trà' }));

    expect(screen.queryByText('Bạc Xỉu Đá')).not.toBeInTheDocument();
    expect(screen.getByText('Trà Đào')).toBeInTheDocument();
  });

  it('tải toàn bộ menu kèm món hết hàng để dựng danh mục', async () => {
    mockedFetchProducts.mockResolvedValue([buildProduct()]);

    render(<MenuScreen />);

    await waitFor(() => expect(mockedFetchProducts).toHaveBeenCalled());
    expect(mockedFetchProducts).toHaveBeenCalledWith(
      { includeUnavailable: true },
      expect.anything(),
    );
  });
});
