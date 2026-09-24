import { invoiceCheckout, pesapalConfig } from '@/server/pesapal';
import { PayInvoice } from '@/components/pay-invoice';
export const dynamic = 'force-dynamic';
export const metadata = {
  robots: { index: false, follow: false },
  title: 'Private invoice | Yingira',
};
export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await invoiceCheckout(token, 'view');
  if (!data)
    return (
      <main className="standalone">
        <h1>Invoice link unavailable.</h1>
        <p>Contact your planner for a current payment link.</p>
      </main>
    );
  const config = pesapalConfig('invoice', data.organizationId);
  return (
    <PayInvoice
      data={data}
      token={token}
      ready={!!config}
      mode={config?.mode || ''}
    />
  );
}
