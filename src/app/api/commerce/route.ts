import { commerceSchema } from '@/lib/commerce';
import { boundedBody, requireOrigin } from '@/server/planning';
import { supabase } from '@/server/supabase';
import { commerceLinks } from '@/server/commerce';
import { encryptionKey } from '@/server/config';
import { issueToken } from '@/lib/tokens';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const parsed = commerceSchema.safeParse(
      JSON.parse((await boundedBody(request, 150000)).toString()),
    );
    if (!parsed.success)
      return Response.json(
        { message: parsed.error.issues[0]?.message || 'Check your fields.' },
        { status: 422 },
      );
    const { action, ...data } = parsed.data;
    const db = await supabase();
    const user = await db.auth.getUser();
    if (!user.data.user)
      return Response.json(
        { message: 'Sign in to continue.' },
        { status: 401 },
      );
    let issued = {};
    if (action === 'approval_create') {
      const token = issueToken(encryptionKey());
      issued = {
        tokenHash: token.tokenHash,
        tokenCiphertext: token.tokenCiphertext,
      };
    }
    const r = await db.rpc('yingira_commerce', {
      p_action: action,
      p_data: { ...data, ...issued },
    });
    if (r.error)
      return Response.json(
        {
          message:
            r.error.code === 'P0001'
              ? r.error.message
              : r.error.code === '42501'
                ? 'Administrator access required.'
                : r.error.code === '23503'
                  ? 'This item is still linked to other planning or payment records.'
                  : 'Check your details and reload before retrying.',
        },
        { status: r.error.code === '42501' ? 403 : 400 },
      );
    return Response.json(action === 'state' ? commerceLinks(r.data) : r.data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      {
        message:
          'Could not confirm this request. Check your connection and retry the same form.',
      },
      { status: 503 },
    );
  }
}
