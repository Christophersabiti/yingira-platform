import { z } from 'zod';
const uuid = z.string().uuid();
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const name = z.string().trim().min(2).max(160);
export const commandSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start_shift'),
    eventId: uuid,
    leaseId: uuid,
    role: z.enum(['supervisor', 'usher']),
  }),
  z.object({
    action: z.enum(['heartbeat_shift', 'end_shift', 'supervisor_overview']),
    eventId: uuid,
    leaseId: uuid,
  }),
  z.object({
    action: z.literal('release_staff_shift'),
    eventId: uuid,
    userId: uuid,
  }),
  z.object({
    action: z.literal('cancel_staff_invitation'),
    eventId: uuid,
    invitationId: uuid,
  }),
  z.object({ action: z.literal('create_organization'), name }),
  z.object({
    action: z.literal('create_event'),
    organizationId: uuid,
    title: name,
    venue: name,
    startsAt: z.string().datetime({ offset: true }),
    timezone: z.string().refine((s) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: s });
        return true;
      } catch {
        return false;
      }
    }, 'Choose a valid timezone'),
  }),
  z.object({
    action: z.literal('create_guest'),
    eventId: uuid,
    name,
    phone: z
      .string()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        'Use an international phone number, e.g. +256700000001',
      ),
    capacity: z.number().int().min(1).max(100),
    tableLabel: z.string().trim().max(60),
  }),
  z.object({
    action: z.literal('set_event_status'),
    eventId: uuid,
    status: z.enum(['draft', 'active', 'closed']),
  }),
  z.object({
    action: z.literal('assign_staff'),
    eventId: uuid,
    email: z.string().email().max(254),
    gateId: uuid,
    role: z.enum(['usher', 'supervisor']),
  }),
  z.object({ action: z.literal('disable_staff'), eventId: uuid, userId: uuid }),
  z.object({
    action: z.enum(['reissue', 'revoke']),
    eventId: uuid,
    invitationId: uuid,
  }),
  z.object({
    action: z.literal('validate'),
    leaseId: uuid.optional(),
    eventId: uuid,
    gateId: uuid,
    token,
  }),
  z.object({
    action: z.literal('admit'),
    leaseId: uuid.optional(),
    eventId: uuid,
    gateId: uuid,
    token,
    quantity: z.number().int().min(1).max(100),
    expectedVersion: z.number().int().min(0),
    idempotencyKey: uuid,
    deviceId: uuid,
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export type Receipt = {
  transactionId: string;
  acceptedAt: string;
  quantity: number;
  initialCount: number;
  insideCount: number;
  remaining: number;
  version: number;
  tableLabel: string;
  guestName: string;
};
export type Scan = {
  guestName: string;
  phoneSuffix: string;
  capacity: number;
  initialCount: number;
  insideCount: number;
  remaining: number;
  version: number;
  tableLabel: string;
};
export type Result<T = unknown> =
  { ok: true; data: T } | { ok: false; code: string; message: string };
export type Dashboard = {
  canCreateOrganization: boolean;
  organizations: { id: string; name: string }[];
  events: {
    id: string;
    title: string;
    venue: string;
    starts_at: string;
    status: string;
    organization_id: string;
    is_admin: boolean;
    role: StaffRole | null;
  }[];
};
export type EventDetail = {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
  timezone: string;
  status: 'draft' | 'active' | 'closed';
  isAdmin: boolean;
  role: StaffRole | null;
  pendingStaff: { id: string; email: string; role: StaffRole }[];
  gates: { id: string; name: string }[];
  guests: {
    id: string;
    name: string;
    phone_suffix: string;
    capacity: number;
    initial_count: number;
    table_label: string;
    token_ciphertext: string | null;
    revoked: boolean;
  }[];
  staff: {
    user_id: string;
    on_shift: boolean;
    email: string;
    role: string;
    active: boolean;
    gate_name: string;
  }[];
  metrics: {
    invitations: number;
    capacity: number;
    admitted: number;
    inside: number;
  };
  recent: {
    id: string;
    guest_name: string;
    quantity: number;
    accepted_at: string;
    gate_name: string;
  }[];
};
export type PublicInvitation = {
  eventId: string;
  design: unknown;
  guestName: string;
  title: string;
  venue: string;
  startsAt: string;
  timezone: string;
  capacity: number;
  tableLabel: string;
};
export function parseQr(value: string, origin: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== new URL(origin).origin || url.search || url.hash)
      return null;
    const match = url.pathname.match(/^\/i\/([A-Za-z0-9_-]{43})$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export type StaffRole = 'supervisor' | 'usher';
export type SupervisorOverview = Pick<EventDetail, 'metrics' | 'recent'>;
