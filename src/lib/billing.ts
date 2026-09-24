import { z } from 'zod';
import type { Brand, InvoiceLine } from './commerce';
const uuid = z.string().uuid();
const title = z.string().trim().min(1).max(160);
export const billingSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('state'), eventId: uuid }),
  z.object({
    action: z.literal('plan_save'),
    eventId: uuid,
    id: uuid,
    expectedVersion: z.number().int().min(0),
    name: title.max(100),
    description: z.string().max(1500),
    price: z.number().int().min(1).max(1e12),
    days: z.union([z.literal(30), z.literal(90), z.literal(365)]),
    eventLimit: z.number().int().min(1).max(10000),
    guestLimit: z.number().int().min(1).max(1000000),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal('subscription_order'),
    eventId: uuid,
    id: uuid,
    planId: uuid,
    planVersion: z.number().int().min(1),
    customerName: title,
  }),
  z.object({
    action: z.literal('invoice_link'),
    eventId: uuid,
    id: uuid,
    invoiceId: uuid,
  }),
  z.object({
    action: z.enum(['revoke_link', 'process_order', 'verify_order']),
    eventId: uuid,
    id: uuid,
    trackingId: uuid.optional(),
  }),
]);
export type BillingCommand = z.infer<typeof billingSchema>;
export type SubscriptionPlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  days: 30 | 90 | 365;
  event_limit: number;
  guest_limit: number;
  active: boolean;
  version: number;
};
export type BillingOrder = {
  id: string;
  purpose: 'invoice' | 'subscription';
  invoice_id: string | null;
  amount: number;
  currency: 'UGX';
  status: string;
  tracking_id: string | null;
  provider_mode: 'sandbox' | 'live' | null;
  created_at: string;
  last_error: string | null;
};
export type BillingState = {
  organizationId: string;
  isPlatformAdmin: boolean;
  plans: SubscriptionPlan[];
  subscription: {
    plan_name: string;
    plan_id: string;
    event_limit: number;
    guest_limit: number;
    expires_at: string;
    starts_at: string | null;
  } | null;
  orders: BillingOrder[];
  invoiceLinks: {
    id: string;
    invoiceId: string;
    expiresAt: string;
    revoked: boolean;
    link?: string;
  }[];
  platformReady: boolean;
  merchantReady: boolean;
  platformMode: string;
  merchantMode: string;
};
export type PayView = {
  organizationId: string;
  eventTitle: string;
  number: string;
  clientName: string;
  currency: 'UGX';
  total: number;
  paid: number;
  lines: InvoiceLine[];
  notes: string;
  brand: Brand;
  due: string | null;
};
export const checkoutSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  id: uuid,
  name: title,
  email: z.string().email().max(254),
  phone: z.string().regex(/^(\+[1-9]\d{7,14})?$/),
});
export async function billingCall<T>(command: BillingCommand): Promise<T> {
  const r = await fetch('/api/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.message || 'Billing request failed.');
  return d;
}
