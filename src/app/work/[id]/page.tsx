import { authenticated, query } from '@/server/data';
import { appOrigin } from '@/server/config';
import type { EventDetail } from '@/lib/contracts';
import { StaffWorkspace } from '@/components/staff-workspace';
import { notFound } from 'next/navigation';
import { z } from 'zod';
export default async function WorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { user } = await authenticated();
  const event = await query<EventDetail>('event', { eventId: id });
  const requested = (await searchParams).role;
  const role = event.isAdmin
    ? requested === 'supervisor'
      ? 'supervisor'
      : 'usher'
    : event.role;
  if (!role) notFound();
  return (
    <StaffWorkspace
      key={`${id}:${role}`}
      userId={user.id}
      role={role}
      isAdmin={event.isAdmin}
      event={{
        id: event.id,
        title: event.title,
        venue: event.venue,
        status: event.status,
        gates: event.gates,
      }}
      origin={appOrigin()}
    />
  );
}
