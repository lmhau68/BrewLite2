import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MenuCard } from '@/components/menu-card';
import type { Product } from '@/lib/types';

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

describe('MenuCard', () => {
  it('hiển thị tên, mô tả và giá của món', () => {
    render(<MenuCard product={buildProduct()} />);

    expect(
      screen.getByRole('heading', { name: 'Bạc Xỉu Đá' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cà phê đen đá pha sẵn')).toBeInTheDocument();
    expect(screen.getByText(/25\.000/)).toBeInTheDocument();
  });

  it('hiển thị nhãn "Hết hàng" khi món không còn khả dụng', () => {
    render(
      <MenuCard product={buildProduct({ isAvailable: false, stockQuantity: 0 })} />,
    );

    expect(screen.getByText('Hết hàng')).toBeInTheDocument();
  });

  it('không hiển thị nhãn "Hết hàng" khi món còn bán', () => {
    render(<MenuCard product={buildProduct()} />);

    expect(screen.queryByText('Hết hàng')).not.toBeInTheDocument();
  });

  it('bỏ qua mô tả khi món không có mô tả', () => {
    render(<MenuCard product={buildProduct({ description: null })} />);

    expect(
      screen.queryByText('Cà phê đen đá pha sẵn'),
    ).not.toBeInTheDocument();
  });
});
