import { authenticated, query } from '@/server/data';
import type { EventDetail } from '@/lib/contracts';
import { ScannerClient } from '@/components/scanner-client';
import { appOrigin } from '@/server/config';
import { notFound } from 'next/navigation';
import { z } from 'zod';
export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { user } = await authenticated();
  const event = await query<EventDetail>('event', { eventId: id });
  return (
    <ScannerClient
      userId={user.id}
      event={{ id: event.id, title: event.title, gates: event.gates }}
      origin={appOrigin()}
    />
  );
}
