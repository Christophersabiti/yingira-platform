import { createClient } from '@supabase/supabase-js';
import { clientPortal } from '@/server/commerce';
import { publicConfig } from '@/server/config';
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('approval') || '';
    const data = await clientPortal(token);
    const brand = data?.snapshot.brand;
    if (!brand?.logoEventId || !brand.logoAssetId)
      return new Response('Unavailable', { status: 404 });
    const db = createClient(
      publicConfig().url,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false } },
    );
    const file = await db.storage
      .from('invitation-assets')
      .download(`${brand.logoEventId}/${brand.logoAssetId}.webp`);
    if (file.error || !file.data) throw Error();
    return new Response(file.data, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Unavailable', { status: 404 });
  }
}
