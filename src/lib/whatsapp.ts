import { z } from 'zod';
const uuid = z.string().uuid();
export const whatsappSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['state', 'dispatch']), eventId: uuid }),
  z.object({
    action: z.literal('consent'),
    eventId: uuid,
    invitationId: uuid,
    allowed: z.boolean(),
    evidence: z.string().trim().min(8).max(500),
  }),
  z.object({
    action: z.literal('queue'),
    eventId: uuid,
    campaignId: uuid,
    kind: z.enum(['invitation', 'reminder']),
    guestIds: z.array(uuid).min(1).max(500),
    scheduledAt: z.string().datetime({ offset: true }),
  }),
  z.object({ action: z.literal('cancel'), eventId: uuid, campaignId: uuid }),
]);
export type WhatsAppCommand = z.infer<typeof whatsappSchema>;
export type WhatsAppState = {
  organizationId: string;
  configured: boolean;
  sender: string;
  guests: {
    id: string;
    name: string;
    phone: string;
    allowed: boolean;
    evidence: string | null;
    suppressed: boolean;
    responded: boolean;
    revoked: boolean;
  }[];
  messages: {
    id: string;
    campaignId: string;
    name: string;
    status: string;
    lastError: string | null;
    kind: string;
    scheduledAt: string;
    updatedAt: string;
  }[];
};
export async function whatsappCall<T>(command: WhatsAppCommand): Promise<T> {
  const r = await fetch('/api/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.message || 'WhatsApp unavailable.');
  return d;
}
