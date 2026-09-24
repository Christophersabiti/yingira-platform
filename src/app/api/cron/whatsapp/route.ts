import { timingSafeEqual } from 'node:crypto';
import { dispatchWhatsApp } from '@/server/whatsapp';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return new Response('Unauthorized', { status: 401 });
  try {
    return Response.json(await dispatchWhatsApp());
  } catch {
    return Response.json(
      { message: 'Dispatch failed; inspect queue status.' },
      { status: 500 },
    );
  }
}
