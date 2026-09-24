import { z } from 'zod';
const uuid = z.string().uuid();
const version = z.number().int().min(0);
export const memberSchema = z.object({
  name: z.string().trim().min(1).max(160),
  response: z.enum(['yes', 'no']),
  meal: z.string().trim().max(80),
  dietary: z.string().trim().max(300),
});
export type HouseholdMember = z.infer<typeof memberSchema>;
export const membersSchema = z.array(memberSchema).min(1).max(100);
export const rsvpSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  members: membersSchema,
  expectedRevision: version,
});
const gate = { eventId: uuid, gateId: uuid, leaseId: uuid };
const movement = {
  ...gate,
  invitationId: uuid,
  quantity: z.number().int().min(1).max(100),
  expectedVersion: version,
  idempotencyKey: uuid,
  deviceId: uuid,
  reason: z.string().trim().max(500),
};
export const operationsSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('state'), eventId: uuid }),
  z.object({
    action: z.literal('rsvp_settings'),
    eventId: uuid,
    enabled: z.boolean(),
    deadline: z.string().datetime({ offset: true }).nullable(),
  }),
  z.object({
    action: z.literal('admin_response'),
    eventId: uuid,
    invitationId: uuid,
    members: membersSchema,
    expectedRevision: version,
  }),
  z.object({
    action: z.literal('table_save'),
    eventId: uuid,
    tableId: uuid.nullable(),
    name: z.string().trim().min(1).max(60),
    capacity: z.number().int().min(1).max(1000),
  }),
  z.object({
    action: z.literal('assign_table'),
    eventId: uuid,
    invitationId: uuid,
    tableId: uuid.nullable(),
    expectedVersion: version,
  }),
  z.object({
    action: z.literal('lookup'),
    ...gate,
    search: z.string().trim().min(2).max(180),
  }),
  z.object({ action: z.literal('gate_state'), ...gate }),
  z.object({
    action: z.literal('request_exception'),
    ...gate,
    invitationId: uuid,
    requestId: uuid,
    quantity: z.number().int().min(1).max(100),
    reason: z.string().trim().min(5).max(500),
  }),
  z.object({
    action: z.literal('movement'),
    ...movement,
    kind: z.enum(['INITIAL_ENTRY', 'EXIT', 'REENTRY']),
  }),
  z.object({
    action: z.literal('resolve_exception'),
    ...movement,
    requestId: uuid,
    decision: z.enum(['approve', 'reject']),
  }),
  z.object({
    action: z.literal('queue_mail'),
    eventId: uuid,
    campaignId: uuid,
    kind: z.enum(['invitation', 'reminder']),
    subject: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(2000),
    guestIds: z.array(uuid).min(1).max(500),
  }),
  z.object({
    action: z.literal('cancel_mail'),
    eventId: uuid,
    campaignId: uuid,
  }),
  z.object({ action: z.enum(['process_mail', 'track_mail']), eventId: uuid }),
]);
export type OperationsCommand = z.infer<typeof operationsSchema>;
export type OperationsState = {
  rsvpEnabled: boolean;
  rsvpDeadline: string | null;
  tables: { id: string; name: string; capacity: number; reserved: number }[];
  guests: {
    id: string;
    name: string;
    email: string;
    category: string;
    capacity: number;
    tableId: string | null;
    tableLabel: string;
    version: number;
    members: HouseholdMember[];
    responseRevision: number;
    responseSource: string | null;
    revoked: boolean;
    suppressed: boolean;
  }[];
  messages: {
    id: string;
    campaignId: string;
    guestName: string;
    recipient: string;
    status: string;
    lastError: string | null;
    updatedAt: string;
    kind: string;
    subject: string;
  }[];
};
export type LookupGuest = {
  id: string;
  name: string;
  phoneSuffix: string;
  tableLabel: string;
  capacity: number;
  initialCount: number;
  insideCount: number;
  version: number;
  revoked: boolean;
};
export type GateException = {
  id: string;
  invitationId: string;
  name: string;
  version: number;
  quantity: number;
  reason: string;
  status: string;
  createdAt: string;
};
export class OperationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function operationsCall<T = unknown>(
  command: OperationsCommand,
): Promise<T> {
  const res = await fetch('/api/operations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  if (!res.ok)
    throw new OperationError(
      data.message || 'Unable to complete this action',
      res.status,
    );
  return data as T;
}
