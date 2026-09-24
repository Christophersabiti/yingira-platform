import { z } from 'zod';
import { boundedBody } from '@/server/planning';
import { verifyPesapal } from '@/server/pesapal';
export const maxDuration = 60;
const input = z.object({
  OrderTrackingId: z.string().uuid(),
  OrderMerchantReference: z.string().uuid(),
  OrderNotificationType: z.literal('IPNCHANGE'),
});
async function handle(request: Request) {
  try {
    const raw =
      request.method === 'GET'
        ? Object.fromEntries(new URL(request.url).searchParams)
        : JSON.parse((await boundedBody(request, 4000)).toString());
    const p = input.parse(raw);
    await verifyPesapal(p.OrderMerchantReference, p.OrderTrackingId);
    return Response.json({
      orderNotificationType: p.OrderNotificationType,
      orderTrackingId: p.OrderTrackingId,
      orderMerchantReference: p.OrderMerchantReference,
      status: 200,
    });
  } catch {
    return Response.json({ status: 500 }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
