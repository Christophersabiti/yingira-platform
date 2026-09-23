import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Shell } from '@/components/shell';
import { GuestManager } from '@/components/guest-manager';
import { authenticated, query } from '@/server/data';
import type { EventDetail } from '@/lib/contracts';
import type { PlanningData } from '@/lib/planning';
export default async function GuestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { db, user } = await authenticated();
  const event = await query<EventDetail>('event', { eventId: id });
  if (!event.isAdmin) notFound();
  const r = await db.rpc('yingira_planning', {
    p_action: 'state',
    p_data: { eventId: id },
  });
  if (r.error) throw Error('Guest management is unavailable.');
  const data = r.data as PlanningData;
  data.guests = data.guests.map((g) => ({ ...g, tokenCiphertext: null }));
  return (
    <Shell email={user.email || ''}>
      <GuestManager eventId={id} title={event.title} initial={data} />
    </Shell>
  );
}
