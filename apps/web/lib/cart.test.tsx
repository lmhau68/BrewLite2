import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAccessToken, setAccessToken } from './auth';
import { CartProvider, useCart } from './cart';

const GUEST_CART_KEY = 'brewlite-cart-v1:guest';
const USER_ID = '00000000-0000-4000-8000-000000000001';

const savedLines = [
  {
    id: 'line-1',
    productId: 'product-1',
    productName: 'Bạc Xỉu',
    sizeId: 'size-m',
    sizeName: 'M',
    toppings: [],
    quantity: 3,
    unitPrice: 25000,
  },
  {
    id: 'line-2',
    productId: 'product-2',
    productName: 'Trà đào',
    sizeId: null,
    sizeName: null,
    toppings: [],
    quantity: 1,
    unitPrice: 30000,
  },
];

function CartProbe() {
  const cart = useCart();
  return (
    <>
      <p>Đã khởi tạo: {String(cart.initialized)}</p>
      <p>Số món: {cart.itemCount}</p>
      <button
        type="button"
        onClick={() =>
          cart.removePurchased([{ lineId: 'line-1', quantity: 2 }])
        }
      >
        Đồng bộ món đã mua
      </button>
    </>
  );
}

describe('CartProvider payment synchronization', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(savedLines));
  });

  it('persists only the purchased quantity removal and keeps other cart lines', async () => {
    render(
      <CartProvider>
        <CartProbe />
      </CartProvider>,
    );

    expect(await screen.findByText('Đã khởi tạo: true')).toBeInTheDocument();
    expect(screen.getByText('Số món: 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ món đã mua' }));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(GUEST_CART_KEY) ?? '[]')).toEqual([
        { ...savedLines[0], quantity: 1 },
        savedLines[1],
      ]);
    });
    expect(screen.getByText('Số món: 2')).toBeInTheDocument();
  });

  it('keeps each signed-in account cart private and restores it after sign-out', async () => {
    const userCartKey = `brewlite-cart-v1:user:${USER_ID}`;
    window.localStorage.removeItem(GUEST_CART_KEY);
    window.localStorage.setItem(userCartKey, JSON.stringify(savedLines));
    const tokenPayload = btoa(JSON.stringify({ sub: USER_ID }))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    setAccessToken(`header.${tokenPayload}.signature`);

    render(
      <CartProvider>
        <CartProbe />
      </CartProvider>,
    );

    expect(await screen.findByText('Số món: 4')).toBeInTheDocument();
    clearAccessToken();
    expect(await screen.findByText('Số món: 0')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(userCartKey) ?? '[]')).toEqual(
      savedLines,
    );

    setAccessToken(`header.${tokenPayload}.signature`);
    expect(await screen.findByText('Số món: 4')).toBeInTheDocument();
  });
});
