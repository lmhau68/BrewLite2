'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore, useState } from 'react';
import { fetchCurrentUser } from '@/lib/api';
import { clearAccessToken, getAccessToken, subscribeToAuth } from '@/lib/auth';
import { subscribeToCart, useCart } from '@/lib/cart';
import type { PublicUser } from '@/lib/types';

export function SiteNav() {
  const router = useRouter();
  const token = useSyncExternalStore(subscribeToAuth, getAccessToken, () => null);
  const { itemCount } = useCart();
  const [cartCount, setCartCount] = useState(itemCount);
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => setCartCount(itemCount), [itemCount]);
  useEffect(() => subscribeToCart(() => setCartCount(itemCount)), [itemCount]);
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    let active = true;
    void fetchCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch((error: unknown) => {
        console.error('Unable to load current BrewLite user.', error);
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, [token]);

  function signOut() {
    clearAccessToken();
    router.push('/');
  }

  return (
    <nav className="site-nav" aria-label="Điều hướng chính">
      <Link href="/" className="site-nav__brand">BrewLite</Link>
      <div className="site-nav__links">
        <Link href="/cart" aria-label={`Giỏ hàng, ${cartCount} món`}>
          Giỏ hàng ({cartCount})
        </Link>
        {token ? (
          <>
            <Link href="/orders">Đơn hàng</Link>
            {user?.role === 'STAFF' || user?.role === 'MANAGER' ? (
              <Link href="/staff/orders">Quầy</Link>
            ) : null}
            <button type="button" className="site-nav__button" onClick={signOut}>
              Đăng xuất
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Đăng nhập</Link>
            <Link href="/register">Đăng ký</Link>
          </>
        )}
      </div>
    </nav>
  );
}
