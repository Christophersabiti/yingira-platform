import { InvitationCard } from '@/components/invitation-card';
import { designSchema } from '@/lib/planning';
import Image from 'next/image';
import QRCode from 'qrcode';
import { invitation } from '@/server/invitation';
import { appOrigin } from '@/server/config';
import { CalendarDays, MapPin, Users } from 'lucide-react';
export const dynamic = 'force-dynamic';
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await invitation(token);
  if (!data)
    return (
      <main className="standalone">
        <span className="eyebrow">INVITATION UNAVAILABLE</span>
        <h1>Please contact your host.</h1>
        <p>
          This invitation link is no longer available. Ask your organizer for
          the current invitation.
        </p>
      </main>
    );
  const qr = await QRCode.toDataURL(`${appOrigin()}/i/${token}`, {
    width: 320,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: { dark: '#24392b', light: '#ffffff' },
  });
  const design = designSchema.safeParse(data.design);
  if (design.success)
    return (
      <main className="guest-page">
        <InvitationCard
          design={design.data}
          details={data}
          qr={qr}
          photoUrl={
            design.data.assetId
              ? `/api/planning/assets?eventId=${data.eventId}&assetId=${design.data.assetId}&token=${token}`
              : undefined
          }
        />
      </main>
    );
  return (
    <main className="guest-page">
      <div className="guest-invitation">
        <span className="eyebrow">WITH WARMTH, YOU ARE INVITED</span>
        <div className="floral">✳</div>
        <h1>{data.title}</h1>
        <div className="fine-line" />
        <p className="guest-salutation">Dear {data.guestName},</p>
        <p>
          Some moments are even more special
          <br />
          with you there.
        </p>
        <div className="invitation-details">
          <p>
            <CalendarDays size={18} />
            {new Date(data.startsAt).toLocaleString('en-GB', {
              dateStyle: 'long',
              timeStyle: 'short',
              timeZone: data.timezone,
            })}
          </p>
          <p>
            <MapPin size={18} />
            {data.venue}
          </p>
          <p>
            <Users size={18} />
            An invitation for {data.capacity}{' '}
            {data.capacity === 1 ? 'person' : 'people'}
          </p>
        </div>
        <div className="qr-card">
          <Image
            src={qr}
            width={240}
            height={240}
            alt={`Entrance QR invitation for ${data.guestName}`}
            unoptimized
          />
          <strong>Your invitation to a lovely day.</strong>
          <p>
            Present this QR at the entrance.
            <br />
            Your host will verify your invitation.
          </p>
        </div>
        {data.tableLabel && <p className="table-note">{data.tableLabel}</p>}
        <footer>
          WITH CARE, THROUGH <strong>yingira.</strong>
        </footer>
      </div>
    </main>
  );
}
