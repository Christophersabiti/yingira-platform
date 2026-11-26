import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { publicConfig } from '@/server/config';
import { invitation } from '@/server/invitation';
import { designSchema, designAssetIds } from '@/lib/planning';

const WIDTH = 1200;
const HEIGHT = 630;

// Link-preview image for a guest invitation: the event photo or artwork, shown
// whole over a soft blurred copy of itself, as a JPEG that WhatsApp accepts.
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const token = params.get('token') ?? '';
    const assetId = z.string().uuid().parse(params.get('assetId'));
    const data = await invitation(token);
    const design = designSchema.safeParse(data?.design);
    if (
      !data ||
      !design.success ||
      !designAssetIds(design.data).includes(assetId)
    )
      throw Error('Unavailable');
    const { data: file, error } = await createClient(
      publicConfig().url,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
      .storage.from('invitation-assets')
      .download(`${data.eventId}/${assetId}.webp`);
    if (error || !file) throw Error('Unavailable');
    const source = Buffer.from(await file.arrayBuffer());
    const backdrop = await sharp(source)
      .resize(WIDTH, HEIGHT, { fit: 'cover' })
      .blur(40)
      .modulate({ brightness: 0.75 })
      .toBuffer();
    const front = await sharp(source)
      .resize(WIDTH, HEIGHT, { fit: 'inside' })
      .toBuffer();
    const image = await sharp(backdrop)
      .composite([{ input: front, gravity: 'center' }])
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(image), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Image unavailable', { status: 404 });
  }
}
