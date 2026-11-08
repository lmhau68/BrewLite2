import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductDetail } from '@/components/product-detail';
import { ApiError, fetchProductDetail } from '@/lib/api';
import type { ProductDetail as ProductDetailType } from '@/lib/types';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();

  return { ...actual, fetchProductDetail: vi.fn() };
});

const mockedFetchProductDetail = vi.mocked(fetchProductDetail);

const buildDetail = (
  overrides: Partial<ProductDetailType> = {},
): ProductDetailType => ({
  id: 'product-1',
  name: 'Bạc Xỉu Đá',
  description: 'Cà phê đen đá pha sẵn',
  basePrice: 25000,
  category: 'Cà phê',
  imageUrl: '/images/menu/bac-xiu-da.svg',
  stockQuantity: 10,
  isAvailable: true,
  sizes: [
    { id: 'size-1', sizeName: 'S', price: 0 },
    { id: 'size-2', sizeName: 'M', price: 5000 },
    { id: 'size-3', sizeName: 'L', price: 10000 },
  ],
  toppings: [
    { id: 'top-1', name: 'Trân châu', price: 5000, stockQuantity: 20 },
    { id: 'top-2', name: 'Kem cheese', price: 7000, stockQuantity: 10 },
  ],
  ...overrides,
});

describe('ProductDetail', () => {
  beforeEach(() => {
    mockedFetchProductDetail.mockReset();
  });

  it('hiển thị trạng thái đang tải khi chờ chi tiết món', () => {
    mockedFetchProductDetail.mockReturnValue(new Promise(() => undefined));

    const { container } = render(<ProductDetail productId="product-1" />);

    expect(container.querySelector('.detail__media--skeleton')).not.toBeNull();
  });

  it('hiển thị tên, mô tả, giá và ảnh của món', async () => {
    mockedFetchProductDetail.mockResolvedValue(buildDetail());

    render(<ProductDetail productId="product-1" />);

    expect(
      await screen.findByRole('heading', { name: 'Bạc Xỉu Đá' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cà phê đen đá pha sẵn')).toBeInTheDocument();
    expect(screen.getByText(/25\.000/)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Bạc Xỉu Đá' }),
    ).toHaveAttribute('src', '/images/menu/bac-xiu-da.svg');
  });

  it('hiển thị danh sách size kèm phụ thu', async () => {
    mockedFetchProductDetail.mockResolvedValue(buildDetail());

    render(<ProductDetail productId="product-1" />);

    expect(await screen.findByText('Kích thước')).toBeInTheDocument();

    const sizesSection = screen.getByText('Kích thước').closest('section');
    const sizeOptions = within(sizesSection as HTMLElement).getAllByRole('listitem');

    expect(sizeOptions).toHaveLength(3);
    expect(within(sizesSection as HTMLElement).getByText('S')).toBeInTheDocument();
    expect(within(sizesSection as HTMLElement).getByText('M')).toBeInTheDocument();
    expect(within(sizesSection as HTMLElement).getByText('L')).toBeInTheDocument();
    expect(
      within(sizesSection as HTMLElement).getByText('Miễn phí'),
    ).toBeInTheDocument();
    expect(
      within(sizesSection as HTMLElement).getByText(/\+ 5\.000/),
    ).toBeInTheDocument();
    expect(
      within(sizesSection as HTMLElement).getByText(/\+ 10\.000/),
    ).toBeInTheDocument();
  });

  it('hiển thị danh sách topping kèm giá', async () => {
    mockedFetchProductDetail.mockResolvedValue(buildDetail());

    render(<ProductDetail productId="product-1" />);

    expect(await screen.findByText('Tùy chọn thêm')).toBeInTheDocument();

    const toppingsSection = screen
      .getByText('Tùy chọn thêm')
      .closest('section');
    const scope = within(toppingsSection as HTMLElement);

    expect(scope.getAllByRole('listitem')).toHaveLength(2);
    expect(scope.getByText('Trân châu')).toBeInTheDocument();
    expect(scope.getByText('Kem cheese')).toBeInTheDocument();
    expect(scope.getByText(/\+ 5\.000/)).toBeInTheDocument();
    expect(scope.getByText(/\+ 7\.000/)).toBeInTheDocument();
  });

  it('gọi API với đúng id của món', async () => {
    mockedFetchProductDetail.mockResolvedValue(buildDetail());

    render(<ProductDetail productId="product-1" />);

    await screen.findByRole('heading', { name: 'Bạc Xỉu Đá' });

    expect(mockedFetchProductDetail).toHaveBeenCalledWith(
      'product-1',
      expect.anything(),
    );
  });

  it('hiển thị trạng thái lỗi kèm nút thử lại khi API thất bại', async () => {
    mockedFetchProductDetail.mockRejectedValue(
      new ApiError('Không thể kết nối tới máy chủ.', 0),
    );

    render(<ProductDetail productId="product-1" />);

    expect(await screen.findByText('Không tải được menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('hiển thị thông báo khi món không có tùy chọn nào', async () => {
    mockedFetchProductDetail.mockResolvedValue(
      buildDetail({ sizes: [], toppings: [] }),
    );

    render(<ProductDetail productId="product-1" />);

    expect(
      await screen.findByText('Món này không có tùy chọn kích thước.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Món này không có tùy chọn topping.'),
    ).toBeInTheDocument();
  });
});
