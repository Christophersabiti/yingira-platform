import { Shell } from '@/components/shell';
import { EventView } from '@/components/event-detail';
import { authenticated, query } from '@/server/data';
import { appOrigin, encryptionKey } from '@/server/config';
import { openToken } from '@/lib/tokens';
import type { EventDetail } from '@/lib/contracts';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { user } = await authenticated();
  const event = await query<EventDetail>('event', { eventId: id });
  if (!event.isAdmin) redirect(`/work/${id}`);
  const links: Record<string, string> = {};
  for (const guest of event.guests)
    if (guest.token_ciphertext)
      links[guest.id] =
        `${appOrigin()}/i/${openToken(guest.token_ciphertext, encryptionKey())}`;
  return (
    <Shell email={user.email ?? ''}>
      <EventView
        event={{
          ...event,
          guests: event.guests.map((g) => ({ ...g, token_ciphertext: null })),
        }}
        links={links}
      />
    </Shell>
  );
}
