import { notFound } from 'next/navigation';
import { z } from 'zod';
import { authenticated } from '@/server/data';
import { billingState } from '@/server/pesapal';
import { commerceLinks } from '@/server/commerce';
import { Shell } from '@/components/shell';
import { EventBilling } from '@/components/event-billing';
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { db, user } = await authenticated();
  const [billing, planning] = await Promise.all([
    db.rpc('yingira_billing', { p_action: 'state', p_data: { eventId: id } }),
    db.rpc('yingira_commerce', { p_action: 'state', p_data: { eventId: id } }),
  ]);
  if (billing.error?.code === '42501' || planning.error?.code === '42501')
    notFound();
  if (billing.error || planning.error)
    throw Error('Billing workspace unavailable.');
  return (
    <Shell email={user.email || ''}>
      <EventBilling
        initial={billingState(billing.data)}
        event={commerceLinks(planning.data)}
        selectedInvoice={(await searchParams).invoice || ''}
      />
    </Shell>
  );
}
