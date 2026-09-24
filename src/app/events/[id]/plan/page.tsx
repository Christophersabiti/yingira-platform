import { notFound } from 'next/navigation';
import { z } from 'zod';
import { authenticated } from '@/server/data';
import { commerceLinks } from '@/server/commerce';
import { Shell } from '@/components/shell';
import { EventPlanner } from '@/components/event-planner';
export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { db, user } = await authenticated();
  const r = await db.rpc('yingira_commerce', {
    p_action: 'state',
    p_data: { eventId: id },
  });
  if (r.error?.code === '42501') notFound();
  if (r.error) throw Error('Planning workspace unavailable.');
  return (
    <Shell email={user.email || ''}>
      <EventPlanner initial={commerceLinks(r.data)} />
    </Shell>
  );
}
