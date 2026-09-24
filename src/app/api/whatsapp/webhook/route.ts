import { z } from 'zod';
import { boundedBody } from '@/server/planning';
import { appOrigin } from '@/server/config';
import {
  deliveryStatus,
  validTwilioSignature,
  whatsappAccounts,
  whatsappWorker,
} from '@/server/whatsapp';
export async function POST(request: Request) {
  try {
    const url = new URL(request.url),
      message = url.searchParams.get('message'),
      organization = url.searchParams.get('organization');
    const params = new URLSearchParams(
      (await boundedBody(request, 20000)).toString(),
    );
    const context =
      message && z.string().uuid().safeParse(message).success
        ? await whatsappWorker('context', { id: message })
        : null;
    const org = context?.organizationId || organization;
    const config = whatsappAccounts()[org];
    if (
      !config ||
      params.get('AccountSid') !== config.accountSid ||
      !validTwilioSignature(
        appOrigin() + url.pathname + url.search,
        params,
        request.headers.get('x-twilio-signature') || '',
        config.authToken,
      )
    )
      return new Response('Unauthorized', { status: 403 });
    if (message) {
      const status = deliveryStatus(params.get('MessageStatus') || '');
      const providerId = params.get('MessageSid') || '';
      if (!status || !/^(SM|MM)[0-9a-fA-F]{32}$/.test(providerId))
        return new Response('Invalid status', { status: 400 });
      await whatsappWorker('status', {
        id: message,
        status,
        providerId,
        error: params.get('ErrorCode')
          ? `Provider error ${params.get('ErrorCode')}`
          : null,
      });
    } else if (
      ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(
        (params.get('Body') || '').trim().toUpperCase(),
      )
    ) {
      if (params.get('To') !== config.from)
        return new Response('Invalid recipient', { status: 400 });
      await whatsappWorker('stop', {
        organizationId: org,
        phone: (params.get('From') || '').replace(/^whatsapp:/, ''),
      });
    }
    return new Response('<Response/>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch {
    return new Response('Webhook unavailable', { status: 500 });
  }
}
