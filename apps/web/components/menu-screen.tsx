'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, fetchProducts } from '@/lib/api';
import type { Product } from '@/lib/types';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { MenuCard } from '@/components/menu-card';
import { MenuSkeleton } from '@/components/menu-skeleton';

type Status = 'loading' | 'success' | 'error';

/** Mục danh mục luôn hiển thị đầu tiên, đại diện cho toàn bộ menu. */
const ALL_CATEGORIES = 'Tất cả';

export function MenuScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setStatus('loading');
    setErrorMessage('');

    try {
      // Tải toàn bộ menu một lần; lọc theo danh mục thực hiện phía client
      // để chuyển danh mục không phải chờ round-trip mạng.
      const data = await fetchProducts({ includeUnavailable: true }, signal);

      setProducts(data);
      setStatus('success');
    } catch (error) {
      if (signal.aborted) {
        return;
      }

      setErrorMessage(
        error instanceof ApiError ? error.message : 'Đã xảy ra lỗi khi tải menu.',
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load, reloadToken]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!isRetrying) {
      return;
    }

    const timer = setTimeout(() => setIsRetrying(false), 1000);

    return () => clearTimeout(timer);
  }, [isRetrying]);

  // Danh mục suy ra từ chính danh sách món đã tải.
  const categories = useMemo(
    () => [
      ALL_CATEGORIES,
      ...Array.from(new Set(products.map((product) => product.category))),
    ],
    [products],
  );

  const visibleProducts = useMemo(() => {
    const filtered =
      selectedCategory === ALL_CATEGORIES
        ? products
        : products.filter((product) => product.category === selectedCategory);

    // Menu chính không hiển thị món đã hết hàng hoặc ngừng bán (FR-01).
    return filtered.filter((product) => product.isAvailable);
  }, [products, selectedCategory]);

  const content = useMemo(() => {
    if (status === 'loading') {
      return <MenuSkeleton />;
    }

    if (status === 'error') {
      return (
        <ErrorState
          message={errorMessage}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      );
    }

    if (visibleProducts.length === 0) {
      return <EmptyState />;
    }

    return (
      <ul className="menu">
        {visibleProducts.map((product) => (
          <MenuCard key={product.id} product={product} />
        ))}
      </ul>
    );
  }, [status, errorMessage, visibleProducts, handleRetry, isRetrying]);

  return (
    <main className="page">
      <header className="header">
        <h1 className="header__title">BrewLite Menu</h1>
        <p className="header__subtitle">
          Chọn món yêu thích và đặt tại quầy.
        </p>
      </header>

      <nav className="filters" aria-label="Danh mục sản phẩm">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className="filters__item"
            aria-pressed={category === selectedCategory}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </nav>

      {content}
    </main>
  );
}
