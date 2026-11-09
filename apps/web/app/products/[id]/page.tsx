import { Suspense, use } from 'react';
import { ProductDetail } from '@/components/product-detail';
import { ProductDetailFallback } from '@/components/product-detail-fallback';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Trang chi tiết món (FR-02, FR-03): chọn size/topping và thêm vào giỏ.
 *
 * `params` được đọc bên trong `<Suspense>` để Next.js có thể prerender
 * shell của route (Cache Components), còn phần dữ liệu chi tiết tải ở client.
 */
export default function ProductPage({ params }: ProductPageProps) {
  return (
    <Suspense fallback={<ProductDetailFallback />}>
      <ProductDetailRoute params={params} />
    </Suspense>
  );
}

function ProductDetailRoute({ params }: ProductPageProps) {
  const { id } = use(params);

  return <ProductDetail productId={id} />;
}
