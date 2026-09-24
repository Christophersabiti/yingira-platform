import { createClient } from '@supabase/supabase-js';
import { rsvpSchema } from '@/lib/operations';
import { boundedBody, requireOrigin } from '@/server/planning';
import { publicConfig } from '@/server/config';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = rsvpSchema.safeParse(
      JSON.parse((await boundedBody(request, 80000)).toString()),
    );
    if (!body.success)
      return Response.json(
        {
          message:
            'Complete each household member and keep within the invitation allowance.',
        },
        { status: 422 },
      );
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret) throw Error();
    const db = createClient(publicConfig().url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const r = await db.rpc('yingira_rsvp', {
      p_token: body.data.token,
      p_members: body.data.members,
      p_revision: body.data.expectedRevision,
    });
    if (r.error)
      return Response.json(
        {
          message:
            r.error.code === 'P0001'
              ? r.error.message
              : 'Response unavailable. Please contact your host.',
        },
        { status: 400 },
      );
    return Response.json(r.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { message: 'Unable to save your response. Please try again.' },
      { status: 400 },
    );
  }
}
