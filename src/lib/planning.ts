import { z } from 'zod';
export const guestSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z
    .string()
    .regex(
      /^(\+[1-9]\d{7,14})?$/,
      'Use an international phone number or leave blank',
    ),
  email: z.union([z.literal(''), z.string().email().max(254)]),
  capacity: z.number().int().min(1).max(100),
  tableLabel: z.string().trim().max(60),
  category: z.string().trim().max(60),
  note: z.string().trim().max(500),
});
export type GuestInput = z.infer<typeof guestSchema>;
export type PlanningGuest = GuestInput & {
  id: string;
  initialCount: number;
  revoked: boolean;
  tokenCiphertext: string | null;
  version: number;
};
export const templates = [
  {
    id: 'classic',
    name: 'Classic Ivory',
    description: 'Formal names, fine borders and generous space',
    background: '#F8F3E8',
    ink: '#252525',
    accent: '#A88443',
  },
  {
    id: 'botanical',
    name: 'Botanical',
    description: 'Soft arches and a botanical frame',
    background: '#FAF8F1',
    ink: '#294A3C',
    accent: '#7A8D68',
  },
  {
    id: 'portrait',
    name: 'Modern Portrait',
    description: 'A photograph with a clean information panel',
    background: '#FAF7F2',
    ink: '#222222',
    accent: '#B77761',
  },
  {
    id: 'evening',
    name: 'Evening Celebration',
    description: 'Rich navy with a restrained gold border',
    background: '#15243A',
    ink: '#FFF8EC',
    accent: '#B79B62',
  },
  {
    id: 'floral',
    name: 'Floral Romance',
    description: 'Gentle floral details and warm blush',
    background: '#F4E5E4',
    ink: '#612C3E',
    accent: '#AB6B7D',
  },
  {
    id: 'introduction',
    name: 'Contemporary Introduction',
    description: 'Family names, earth tones and geometric detail',
    background: '#F0E4D3',
    ink: '#33251E',
    accent: '#A55239',
  },
] as const;
const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const designSchema = z.object({
  template: z.enum([
    'classic',
    'botanical',
    'portrait',
    'evening',
    'floral',
    'introduction',
  ]),
  mode: z.enum(['template', 'artwork']),
  bride: z.string().max(100),
  groom: z.string().max(100),
  hosts: z.string().max(200),
  message: z.string().max(500),
  dressCode: z.string().max(100),
  directions: z.string().max(300),
  contact: z.string().max(160),
  programme: z.string().max(500),
  background: colour,
  ink: colour,
  accent: colour,
  font: z.enum(['serif', 'sans']),
  assetId: z.string().uuid().nullable(),
  photoX: z.number().min(0).max(100),
  photoY: z.number().min(0).max(100),
  zoom: z.number().min(1).max(3),
  rotation: z.number().min(-180).max(180),
});
export type Design = z.infer<typeof designSchema>;
export const defaultDesign: Design = {
  template: 'classic',
  mode: 'template',
  bride: '',
  groom: '',
  hosts: '',
  message: 'Some moments are even more special with you there.',
  dressCode: '',
  directions: '',
  contact: '',
  programme: '',
  background: '#F8F3E8',
  ink: '#252525',
  accent: '#A88443',
  font: 'serif',
  assetId: null,
  photoX: 50,
  photoY: 50,
  zoom: 1,
  rotation: 0,
};
export type DesignVersion = { id: string; createdAt: string; design: Design };
export type ImportJob = {
  id: string;
  name: string;
  total: number;
  processed: number;
  created: number;
  skipped: number;
  createdAt: string;
};
export type PlanningData = {
  guests: PlanningGuest[];
  draft: Design | null;
  revision: number;
  publishedId: string | null;
  versions: DesignVersion[];
  jobs: ImportJob[];
};
export const planningSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('save_event'),
    eventId: z.string().uuid(),
    title: z.string().trim().min(2).max(160),
    venue: z.string().trim().min(2).max(160),
    startsAt: z.string().datetime({ offset: true }),
    timezone: z
      .string()
      .max(100)
      .refine((s) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: s });
          return true;
        } catch {
          return false;
        }
      }, 'Choose a valid timezone'),
  }),
  z.object({ action: z.literal('state'), eventId: z.string().uuid() }),
  z.object({
    action: z.literal('save_guest'),
    eventId: z.string().uuid(),
    guestId: z.string().uuid(),
    expectedVersion: z.number().int(),
    guest: guestSchema,
  }),
  z.object({
    action: z.literal('create_import'),
    eventId: z.string().uuid(),
    jobId: z.string().uuid(),
    name: z.string().max(100),
    rows: z
      .array(
        guestSchema.extend({
          rowKey: z.number().int().min(1),
          keepDuplicate: z.boolean(),
        }),
      )
      .min(1)
      .max(5000),
  }),
  z.object({
    action: z.literal('run_import'),
    eventId: z.string().uuid(),
    jobId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('save_design'),
    eventId: z.string().uuid(),
    expectedRevision: z.number().int().min(0),
    design: designSchema,
  }),
  z.object({
    action: z.literal('publish_design'),
    eventId: z.string().uuid(),
    expectedRevision: z.number().int().min(0),
  }),
  z.object({
    action: z.literal('restore_design'),
    eventId: z.string().uuid(),
    versionId: z.string().uuid(),
    expectedRevision: z.number().int().min(0),
  }),
]);
export async function planningCall<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const r = await fetch('/api/planning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.message || 'Unable to save. Try again.');
  return d as T;
}
export function csvText(rows: unknown[][]) {
  return (
    '\uFEFF' +
    rows
      .map((r) =>
        r
          .map((v) => {
            let s = String(v ?? '');
            if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n')
  );
}
export function downloadText(text: string, name: string) {
  const u = URL.createObjectURL(
    new Blob([text], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}
export function contrast(a: string, b: string) {
  const l = (s: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  return (Math.max(l(a), l(b)) + 0.05) / (Math.min(l(a), l(b)) + 0.05);
}
