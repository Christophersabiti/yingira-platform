import { z } from 'zod';
import { boundedBody, planningDb, requireOrigin } from '@/server/planning';
import { eventShareLinks } from '@/server/invitation-links';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const { eventId, guestIds } = z
      .object({
        eventId: z.string().uuid(),
        guestIds: z.array(z.string().uuid()).min(1).max(5000),
      })
      .parse(JSON.parse((await boundedBody(request, 250000)).toString()));
    const db = await planningDb(eventId);
    const links = await eventShareLinks(db, eventId);
    if (guestIds.some((id) => !links[id]))
      throw Error(
        'One or more invitations are no longer available. Refresh the guest list before sharing.',
      );
    return Response.json(
      {
        links: Object.fromEntries(
          [...new Set(guestIds)].map((id) => [id, links[id]]),
        ),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : 'Unable to load guest URLs',
      },
      { status: 400 },
    );
  }
}
