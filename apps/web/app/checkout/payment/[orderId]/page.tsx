import { Suspense, use } from 'react';
import { PaymentScreen } from '@/components/payment-screen';

export default function CheckoutPaymentPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  return (
    <Suspense fallback={<main className="page"><section className="panel">Đang tải...</section></main>}>
      <PaymentRoute params={params} />
    </Suspense>
  );
}

function PaymentRoute({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  return <PaymentScreen orderId={orderId} />;
}
