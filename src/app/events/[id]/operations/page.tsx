import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Shell } from '@/components/shell';
import { EventOperations } from '@/components/event-operations';
import { authenticated, query } from '@/server/data';
import type { EventDetail } from '@/lib/contracts';
import { emailReady } from '@/server/mail';
export default async function OperationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { db, user } = await authenticated();
  const event = await query<EventDetail>('event', { eventId: id });
  if (!event.isAdmin) notFound();
  const r = await db.rpc('yingira_operations', {
    p_action: 'state',
    p_data: { eventId: id },
  });
  if (r.error) throw Error('Event operations are unavailable.');
  return (
    <Shell email={user.email || ''}>
      <EventOperations
        eventId={id}
        title={event.title}
        initial={r.data}
        emailConfigured={emailReady()}
      />
    </Shell>
  );
}
