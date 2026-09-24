import { notFound } from 'next/navigation';
import { z } from 'zod';
import { authenticated, query } from '@/server/data';
import { whatsappState } from '@/server/whatsapp';
import { Shell } from '@/components/shell';
import { EventWhatsApp } from '@/components/event-whatsapp';
import type { EventDetail } from '@/lib/contracts';
export default async function WhatsAppPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { db, user } = await authenticated();
  const r = await db.rpc('yingira_whatsapp', {
    p_action: 'state',
    p_data: { eventId: id },
  });
  if (r.error?.code === '42501') notFound();
  if (r.error) throw Error('WhatsApp workspace unavailable.');
  const event = await query<EventDetail>('event', { eventId: id });
  return (
    <Shell email={user.email || ''}>
      <EventWhatsApp
        initial={whatsappState(r.data)}
        eventId={id}
        title={event.title}
      />
    </Shell>
  );
}
