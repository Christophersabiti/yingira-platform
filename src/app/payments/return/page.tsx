import Link from 'next/link';
import { z } from 'zod';
import { verifyPesapal } from '@/server/pesapal';
export const dynamic = 'force-dynamic';
export const metadata = {
  robots: { index: false, follow: false },
  title: 'Payment status | Yingira',
};
export default async function PaymentReturn({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  let status = 'unconfirmed';
  let mode = '';
  try {
    const id = z.string().uuid().parse(p.OrderMerchantReference),
      tracking = z.string().uuid().parse(p.OrderTrackingId);
    const result = await verifyPesapal(id, tracking);
    status = result.status;
    mode = result.mode || '';
  } catch {}
  return (
    <main className="standalone">
      <span className="eyebrow">PESAPAL PAYMENT</span>
      <h1>
        {status === 'completed'
          ? mode === 'sandbox'
            ? 'Test payment confirmed.'
            : 'Payment confirmed.'
          : status === 'failed'
            ? 'Payment failed.'
            : status === 'reversed'
              ? 'Payment reversed.'
              : 'Payment not yet confirmed.'}
      </h1>
      <p>
        {status === 'completed'
          ? mode === 'sandbox'
            ? 'Sandbox test recorded. No real invoice balance or subscription was credited.'
            : 'Your payment has been verified with Pesapal and recorded.'
          : 'A return to this page is not proof of payment. If money was deducted, contact your planner before paying again.'}
      </p>
      <p>
        Return to your original invoice link to see the balance, or open your
        Yingira workspace.
      </p>
      <Link className="button" href="/dashboard">
        Open workspace
      </Link>
    </main>
  );
}
