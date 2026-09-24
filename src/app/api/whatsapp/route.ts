import { whatsappSchema } from '@/lib/whatsapp';
import { boundedBody, requireOrigin } from '@/server/planning';
import { supabase } from '@/server/supabase';
import {
  dispatchWhatsApp,
  whatsappAccounts,
  whatsappState,
} from '@/server/whatsapp';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const p = whatsappSchema.parse(
      JSON.parse((await boundedBody(request, 40000)).toString()),
    );
    const db = await supabase();
    const auth = await db.auth.getUser();
    if (!auth.data.user)
      return Response.json(
        { message: 'Sign in to continue.' },
        { status: 401 },
      );
    const state = await db.rpc('yingira_whatsapp', {
      p_action: 'state',
      p_data: { eventId: p.eventId },
    });
    if (state.error) throw Error('Administrator access required.');
    const config = whatsappAccounts()[state.data.organizationId];
    if (p.action === 'state') return Response.json(whatsappState(state.data));
    if (p.action === 'queue' || p.action === 'dispatch') {
      if (!config)
        throw Error(
          'Connect a WhatsApp Business sender and approved templates before sending.',
        );
    }
    if (p.action === 'dispatch')
      return Response.json(await dispatchWhatsApp(p.eventId));
    const { action, ...data } = p;
    const r = await db.rpc('yingira_whatsapp', {
      p_action: action,
      p_data: {
        ...data,
        ...(p.action === 'queue'
          ? {
              templateSid:
                p.kind === 'invitation'
                  ? config.invitationTemplate
                  : config.reminderTemplate,
            }
          : {}),
      },
    });
    if (r.error)
      throw Error(
        r.error.code === 'P0001'
          ? r.error.message
          : 'Unable to save WhatsApp changes.',
      );
    return Response.json(r.data);
  } catch (e) {
    return Response.json(
      { message: e instanceof Error ? e.message : 'WhatsApp unavailable.' },
      { status: 400 },
    );
  }
}
