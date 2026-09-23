import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Shell } from '@/components/shell';
import { InvitationStudio } from '@/components/invitation-studio';
import { authenticated, query } from '@/server/data';
import { appOrigin, encryptionKey } from '@/server/config';
import { invitationLinks } from '@/lib/tokens';
import type { EventDetail } from '@/lib/contracts';
import type { PlanningData } from '@/lib/planning';
export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guest?: string }>;
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
  if (r.error) throw Error('Invitation studio is unavailable.');
  const data = r.data as PlanningData;
  const links = invitationLinks(
    data.guests.map((g) => ({ id: g.id, token_ciphertext: g.tokenCiphertext })),
    appOrigin(),
    [
      encryptionKey(),
      ...(process.env.INVITATION_PREVIOUS_ENCRYPTION_KEY
        ? [process.env.INVITATION_PREVIOUS_ENCRYPTION_KEY]
        : []),
    ],
  );
  data.guests = data.guests.map((g) => ({ ...g, tokenCiphertext: null }));
  return (
    <Shell email={user.email || ''}>
      <InvitationStudio
        eventId={id}
        event={{
          title: event.title,
          venue: event.venue,
          startsAt: event.startsAt,
          timezone: event.timezone,
        }}
        initial={data}
        links={links}
        selectedGuest={(await searchParams).guest}
      />
    </Shell>
  );
}
