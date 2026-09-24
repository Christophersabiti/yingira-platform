import { checkoutSchema } from '@/lib/billing';
import {
  invoiceCheckout,
  pesapalConfig,
  submitPesapal,
} from '@/server/pesapal';
import { boundedBody, requireOrigin } from '@/server/planning';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const { token, ...input } = checkoutSchema.parse(
      JSON.parse((await boundedBody(request, 4000)).toString()),
    );
    const view = await invoiceCheckout(token, 'view');
    if (!view || !pesapalConfig('invoice', view.organizationId))
      throw Error('This invoice cannot accept online payments yet.');
    const order = (await invoiceCheckout(token, 'order', input)) as unknown as {
      id: string;
    } | null;
    if (!order) throw Error('Invoice unavailable.');
    return Response.json(await submitPesapal(order.id));
  } catch (e) {
    return Response.json(
      { message: e instanceof Error ? e.message : 'Checkout unavailable.' },
      { status: 400 },
    );
  }
}
