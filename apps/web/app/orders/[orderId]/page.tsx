import { Suspense, use } from 'react';
import { OrderDetailScreen } from '@/components/order-detail-screen';

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  return (
    <Suspense fallback={<main className="page"><section className="panel">Đang tải...</section></main>}>
      <OrderDetailRoute params={params} />
    </Suspense>
  );
}

function OrderDetailRoute({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  return <OrderDetailScreen orderId={orderId} />;
}
