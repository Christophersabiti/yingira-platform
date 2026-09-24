import { operationsSchema } from '@/lib/operations';
import { boundedBody, planningDb, requireOrigin } from '@/server/planning';
import { supabase } from '@/server/supabase';
import { emailReady, processMail, trackMail } from '@/server/mail';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const parsed = operationsSchema.safeParse(
      JSON.parse((await boundedBody(request, 100000)).toString()),
    );
    if (!parsed.success)
      return Response.json(
        { message: parsed.error.issues[0]?.message || 'Check your fields' },
        { status: 422 },
      );
    const { action, ...data } = parsed.data;
    if (action === 'process_mail' || action === 'track_mail') {
      await planningDb(data.eventId);
      return Response.json(
        action === 'process_mail'
          ? await processMail(data.eventId)
          : await trackMail(data.eventId),
      );
    }
    if (action === 'queue_mail' && !emailReady())
      return Response.json(
        {
          message:
            'Email sending is not connected. Configure your verified sender first.',
        },
        { status: 503 },
      );
    const db = await supabase();
    const auth = await db.auth.getUser();
    if (!auth.data.user)
      return Response.json({ message: 'Sign in to continue' }, { status: 401 });
    const r = await db.rpc('yingira_operations', {
      p_action: action,
      p_data: data,
    });
    if (r.error)
      return Response.json(
        {
          message:
            r.error.code === '42501'
              ? 'Your account or active shift does not allow this action.'
              : r.error.code === 'P0001'
                ? r.error.message
                : 'Check your details and try again.',
        },
        { status: /^(22|23|42|P0001)/.test(r.error.code || '') ? 400 : 503 },
      );
    return Response.json(r.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      {
        message:
          'Unable to complete this request. Check your connection and configuration.',
      },
      { status: 503 },
    );
  }
}
