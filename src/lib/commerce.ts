import { z } from 'zod';
export const currencies = [
  'UGX',
  'USD',
  'KES',
  'TZS',
  'RWF',
  'EUR',
  'GBP',
] as const;
export type Currency = (typeof currencies)[number];
export function currencyDigits(currency: Currency) {
  return ['UGX', 'RWF'].includes(currency) ? 0 : 2;
}
export function parseMoney(value: string, currency: Currency): number {
  const digits = currencyDigits(currency);
  const pattern = digits ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/;
  if (!pattern.test(value.trim()))
    throw Error(
      `Enter a non-negative ${currency} amount with at most ${digits} decimal places.`,
    );
  const [whole, fraction = ''] = value.trim().split('.');
  const amount =
    Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  if (!Number.isSafeInteger(amount) || amount > 1_000_000_000_000)
    throw Error('Amount is too large.');
  return amount;
}
export function money(amount: number, currency: Currency) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currencyDisplay: 'code',
    currency,
    minimumFractionDigits: currencyDigits(currency),
    maximumFractionDigits: currencyDigits(currency),
  }).format(amount / 10 ** currencyDigits(currency));
}
export function moneyInput(amount: number, currency: Currency) {
  return (amount / 10 ** currencyDigits(currency)).toFixed(
    currencyDigits(currency),
  );
}
const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const title = text(160).min(1);
const minor = z.number().int().min(0).max(1_000_000_000_000);
const date = z.string().date().nullable();
const instant = z.string().datetime({ offset: true });
const version = z.number().int().min(0);
const edit = { id: uuid, expectedVersion: version };
const mutation = { eventId: uuid, requestId: uuid };
export const invoiceLinesSchema = z
  .array(
    z.object({
      description: title,
      quantity: z.number().int().min(1).max(10000),
      unitAmount: minor,
    }),
  )
  .min(1)
  .max(50)
  .refine(
    (lines) =>
      lines.reduce((s, l) => s + l.quantity * l.unitAmount, 0) <=
      1_000_000_000_000,
    'Invoice total is too large.',
  );
export const commerceSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('state'), eventId: uuid }),
  z.object({
    action: z.literal('settings'),
    ...mutation,
    expectedVersion: version,
    currency: z.enum(currencies),
    budget: minor,
    clientName: text(160),
    clientEmail: z.union([z.literal(''), z.string().email().max(254)]),
  }),
  z.object({
    action: z.literal('task_save'),
    ...mutation,
    ...edit,
    title,
    owner: text(160),
    due: date,
    status: z.enum(['todo', 'in_progress', 'done', 'cancelled']),
    notes: text(2000),
  }),
  z.object({
    action: z.literal('programme_save'),
    ...mutation,
    ...edit,
    title,
    startsAt: instant,
    endsAt: instant,
    location: text(160),
    owner: text(160),
    supplierId: uuid.nullable(),
    notes: text(2000),
  }),
  z.object({
    action: z.literal('supplier_save'),
    ...mutation,
    ...edit,
    name: title,
    category: text(80),
    contact: text(160),
    email: z.union([z.literal(''), z.string().email().max(254)]),
    phone: text(40),
    notes: text(2000),
  }),
  z.object({
    action: z.literal('cost_save'),
    ...mutation,
    ...edit,
    title,
    supplierId: uuid.nullable(),
    planned: minor,
    quoted: minor,
    committed: minor,
    deposit: minor,
    due: date,
    notes: text(2000),
  }),
  z.object({
    action: z.literal('package_save'),
    ...mutation,
    ...edit,
    name: title,
    description: text(2000),
    currency: z.enum(currencies),
    lines: invoiceLinesSchema,
    active: z.boolean(),
  }),
  z.object({
    action: z.literal('invoice_save'),
    ...mutation,
    ...edit,
    clientName: title,
    clientEmail: z.union([z.literal(''), z.string().email().max(254)]),
    due: date,
    lines: invoiceLinesSchema,
    notes: text(2000),
  }),
  z.object({
    action: z.enum(['invoice_issue', 'invoice_void']),
    ...mutation,
    ...edit,
  }),
  z.object({
    action: z.literal('payment_record'),
    ...mutation,
    id: uuid,
    targetId: uuid,
    targetKind: z.enum(['supplier', 'client']),
    amount: minor.min(1),
    paidOn: z.string().date(),
    method: z.enum(['bank', 'mobile_money', 'cash', 'other']),
    reference: text(160).min(1),
    notes: text(500),
  }),
  z.object({
    action: z.literal('payment_reverse'),
    ...mutation,
    id: uuid,
    paymentId: uuid,
    reason: text(500).min(5),
  }),
  z.object({
    action: z.literal('approval_create'),
    ...mutation,
    id: uuid,
    title,
    clientName: title,
    kind: z.enum(['budget', 'programme', 'invoice', 'custom']),
    invoiceId: uuid.nullable(),
    details: text(6000),
    expiresAt: instant,
  }),
  z.object({ action: z.literal('approval_revoke'), ...mutation, id: uuid }),
  z.object({
    action: z.literal('brand_save'),
    ...mutation,
    expectedVersion: version,
    name: title,
    tagline: text(160),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    logoAssetId: uuid.nullable(),
    logoEventId: uuid.nullable(),
    email: z.union([z.literal(''), z.string().email().max(254)]),
    phone: text(40),
  }),
  z.object({
    action: z.literal('delete_item'),
    ...mutation,
    ...edit,
    kind: z.enum(['task', 'programme', 'supplier', 'cost']),
  }),
]);
export type CommerceCommand = z.infer<typeof commerceSchema>;
export type InvoiceLine = z.infer<typeof invoiceLinesSchema>[number];
export type PlanTask = {
  id: string;
  title: string;
  owner: string;
  due: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  notes: string;
  version: number;
};
export type ProgrammeItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  owner: string;
  supplierId: string | null;
  notes: string;
  version: number;
};
export type Supplier = {
  id: string;
  name: string;
  category: string;
  contact: string;
  email: string;
  phone: string;
  notes: string;
  version: number;
};
export type Cost = {
  id: string;
  title: string;
  supplierId: string | null;
  planned: number;
  quoted: number;
  committed: number;
  deposit: number;
  due: string | null;
  notes: string;
  paid: number;
  version: number;
};
export type ServicePackage = {
  id: string;
  name: string;
  description: string;
  currency: Currency;
  lines: InvoiceLine[];
  active: boolean;
  version: number;
};
export type ClientInvoice = {
  id: string;
  number: string | null;
  clientName: string;
  clientEmail: string;
  due: string | null;
  lines: InvoiceLine[];
  notes: string;
  status: 'draft' | 'issued' | 'void';
  total: number;
  paid: number;
  version: number;
  issuedAt: string | null;
  brand: Brand | null;
};
export type Payment = {
  id: string;
  targetId: string;
  targetKind: 'supplier' | 'client';
  amount: number;
  paidOn: string;
  method: string;
  reference: string;
  notes: string;
  reversalOf: string | null;
  createdAt: string;
};
export type Approval = {
  id: string;
  title: string;
  clientName: string;
  kind: string;
  status: 'pending' | 'approved' | 'changes_requested' | 'revoked';
  expiresAt: string;
  createdAt: string;
  decidedAt: string | null;
  signer: string | null;
  comment: string | null;
  link?: string;
};
export type Brand = {
  name: string;
  tagline: string;
  color: string;
  logoAssetId: string | null;
  logoEventId: string | null;
  email: string;
  phone: string;
  version: number;
};
export type CommerceState = {
  event: { id: string; title: string; startsAt: string; timezone: string };
  settings: {
    currency: Currency;
    budget: number;
    clientName: string;
    clientEmail: string;
    version: number;
  };
  brand: Brand;
  tasks: PlanTask[];
  programme: ProgrammeItem[];
  suppliers: Supplier[];
  costs: Cost[];
  packages: ServicePackage[];
  invoices: ClientInvoice[];
  payments: Payment[];
  approvals: Approval[];
  usage: { events: number; invitations: number; admins: number };
};
export type ApprovalView = {
  id: string;
  title: string;
  clientName: string;
  eventTitle: string;
  kind: string;
  status: Approval['status'];
  expiresAt: string;
  createdAt: string;
  decidedAt: string | null;
  signer: string | null;
  comment: string | null;
  snapshot: {
    currency: Currency;
    details: string;
    brand: Brand;
    budget?: {
      budget: number;
      planned: number;
      quoted: number;
      committed: number;
      costs: {
        title: string;
        planned: number;
        quoted: number;
        committed: number;
      }[];
    };
    programme?: ProgrammeItem[];
    invoice?: ClientInvoice;
  };
};
export const approvalDecisionSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  decision: z.enum(['approved', 'changes_requested']),
  signer: text(160).min(2),
  comment: text(2000),
  requestId: uuid,
});
export async function commerceCall<T>(command: CommerceCommand): Promise<T> {
  const response = await fetch('/api/commerce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.message || 'Could not save. Please retry.');
  return data;
}
