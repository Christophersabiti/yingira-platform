import { approvalDecisionSchema } from '@/lib/commerce';
import { boundedBody, requireOrigin } from '@/server/planning';
import { clientPortal } from '@/server/commerce';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const { token, ...data } = approvalDecisionSchema.parse(
      JSON.parse((await boundedBody(request, 12000)).toString()),
    );
    const result = await clientPortal(token, 'decide', data);
    if (!result)
      return Response.json(
        {
          message:
            'This link has expired or been revoked. Contact your planner.',
        },
        { status: 404 },
      );
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json(
      {
        message:
          e instanceof Error ? e.message : 'Could not record the decision.',
      },
      { status: 400 },
    );
  }
}
