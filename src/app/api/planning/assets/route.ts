import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { publicConfig } from '@/server/config';
import { boundedBody, planningDb, requireOrigin } from '@/server/planning';
import { invitation } from '@/server/invitation';
import { designSchema } from '@/lib/planning';
function storage() {
  return createClient(publicConfig().url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from('invitation-assets');
}
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const eventId = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get('eventId'));
    const db = await planningDb(eventId);
    const input = await boundedBody(request, 4_000_000);
    const image = sharp(input, { limitInputPixels: 30_000_000 });
    const meta = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(meta.format || '') ||
      (meta.pages || 1) > 1
    )
      throw Error('Choose a single JPEG, PNG or WebP photo.');
    const output = await image
      .rotate()
      .resize(1800, 2400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
    const id = randomUUID();
    const path = `${eventId}/${id}.webp`;
    const bucket = storage();
    const upload = await bucket.upload(path, output, {
      contentType: 'image/webp',
      upsert: false,
    });
    if (upload.error) throw Error('Photo upload failed. Try again.');
    const saved = await db.rpc('yingira_planning', {
      p_action: 'register_asset',
      p_data: { eventId, assetId: id },
    });
    if (saved.error) {
      await bucket.remove([path]);
      throw Error('Unable to attach photo.');
    }
    return Response.json({
      id,
      lowResolution: (meta.width || 0) < 1000 || (meta.height || 0) < 1000,
    });
  } catch (e) {
    return Response.json(
      { message: e instanceof Error ? e.message : 'Upload failed' },
      { status: 400 },
    );
  }
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const eventId = z.string().uuid().parse(params.get('eventId'));
    const assetId = z.string().uuid().parse(params.get('assetId'));
    const token = params.get('token');
    if (token) {
      const data = await invitation(token);
      const design = designSchema.safeParse(data?.design);
      if (
        !data ||
        data.eventId !== eventId ||
        !design.success ||
        design.data.assetId !== assetId
      )
        throw Error('Unavailable');
    } else {
      const db = await planningDb(eventId);
      const check = await db.rpc('yingira_planning', {
        p_action: 'asset',
        p_data: { eventId, assetId },
      });
      if (check.error) throw Error('Unavailable');
    }
    const { data, error } = await storage().download(
      `${eventId}/${assetId}.webp`,
    );
    if (error || !data) throw Error('Unavailable');
    return new Response(data, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return new Response('Image unavailable', { status: 404 });
  }
}
