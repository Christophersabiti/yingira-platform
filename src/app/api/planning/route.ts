import { planningSchema } from '@/lib/planning';
import { planningDb, requireOrigin, boundedBody } from '@/server/planning';
import { issueToken } from '@/lib/tokens';
import { encryptionKey } from '@/server/config';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = planningSchema.parse(
      JSON.parse((await boundedBody(request, 3_500_000)).toString()),
    );
    const db = await planningDb(body.eventId);
    const { action, ...payload } = body;
    if (action === 'run_import') {
      const pending = await db.rpc('yingira_planning', {
        p_action: 'import_pending',
        p_data: payload,
      });
      if (pending.error) throw Error('Unable to resume this import.');
      const tokens = (pending.data as { rowKey: number }[]).map((r) => ({
        ...r,
        ...issueToken(encryptionKey()),
      }));
      const result = await db.rpc('yingira_planning', {
        p_action: 'import_batch',
        p_data: { ...payload, tokens },
      });
      if (result.error) throw Error('Import paused. Resume to retry safely.');
      return Response.json(result.data);
    }
    const result = await db.rpc('yingira_planning', {
      p_action: action,
      p_data: payload,
    });
    if (result.error) {
      const messages = [
        'Guest changed. Refresh before editing.',
        'Design changed in another tab. Reload before saving.',
        'Save a draft first',
      ];
      throw Error(
        messages.includes(result.error.message)
          ? result.error.message
          : 'Unable to save. Check values and refresh. Capacity cannot be lower than admissions.',
      );
    }
    return Response.json(result.data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return Response.json(
      { message: e instanceof Error ? e.message : 'Request failed' },
      { status: 400 },
    );
  }
}
