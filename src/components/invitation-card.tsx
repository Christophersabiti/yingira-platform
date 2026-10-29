/* eslint-disable @next/next/no-img-element */
import QRCode from 'qrcode';
import type { Design } from '@/lib/planning';
import { InvitationFlowers } from './invitation-flowers';
export type CardDetails = {
  title: string;
  venue: string;
  startsAt: string;
  timezone: string;
  guestName: string;
  capacity: number;
  tableLabel: string;
};

// Omitting origin lets Maps use the scanning guest's current location.
export function venueDirections(venue: string, map: string) {
  let destination = venue;
  let placeId = '';
  try {
    const url = new URL(map);
    destination =
      url.searchParams.get('destination') ||
      url.searchParams.get('query') ||
      url.searchParams.get('q') ||
      venue;
    placeId =
      url.searchParams.get('destination_place_id') ||
      url.searchParams.get('query_place_id') ||
      '';
  } catch {
    /* The venue name is also a valid Maps destination. */
  }
  const params = new URLSearchParams({ api: '1', destination });
  if (placeId) params.set('destination_place_id', placeId);
  return `https://www.google.com/maps/dir/?${params}`;
}

function DirectionQr({ venue, map }: { venue: string; map: string }) {
  const href = venueDirections(venue, map);
  const { modules } = QRCode.create(href, { errorCorrectionLevel: 'M' });
  const size = modules.size;
  const path: string[] = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (modules.get(y, x)) path.push(`M${x + 4} ${y + 4}h1v1h-1z`);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="print-map-qr"
      aria-label={`Directions to ${venue}`}
    >
      <svg
        role="img"
        aria-label={`Directions QR for ${venue}`}
        viewBox={`0 0 ${size + 8} ${size + 8}`}
        shapeRendering="crispEdges"
      >
        <rect width="100%" height="100%" fill="#fff" />
        <path d={path.join('')} fill="#000" />
      </svg>
      <span>Scan for directions</span>
    </a>
  );
}

export function InvitationCard({
  design,
  details,
  qr,
  preview = false,
}: {
  design: Design;
  details: CardDetails;
  photoUrl?: string;
  qr?: string;
  preview?: boolean;
}) {
  const names = [design.groom, design.bride].filter(Boolean);
  const e = design.experience;
  return (
    <article className="designed-card print-wedding-card">
      <InvitationFlowers style="botanical" className="print-flowers-top" />
      <InvitationFlowers style="botanical" className="print-flowers-bottom" />
      <div className="print-card-content">
        <p className="print-hosts">
          {design.hosts || 'Together with our families'}
        </p>
        <h1>
          {names.length
            ? names.map((name, i) => (
                <span key={i}>
                  {i > 0 && <em>&amp;</em>}
                  {name}
                </span>
              ))
            : details.title}
        </h1>
        <p className="print-message">{design.message}</p>
        <p className="print-recipient">Dear {details.guestName},</p>
        <p className="print-date">
          {new Date(details.startsAt).toLocaleString('en-GB', {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: details.timezone,
          })}
        </p>
        <div className="print-venues">
          {e.ceremonyVenue && (
            <section>
              <h2>Church</h2>
              <strong>{e.ceremonyVenue}</strong>
              {e.ceremonyTime && <p>{e.ceremonyTime}</p>}
              <DirectionQr venue={e.ceremonyVenue} map={e.ceremonyMap} />
            </section>
          )}
          <section>
            <h2>Reception</h2>
            <strong>{e.receptionVenue || details.venue}</strong>
            {e.receptionTime && <p>{e.receptionTime}</p>}
            <DirectionQr
              venue={e.receptionVenue || details.venue}
              map={e.receptionMap}
            />
          </section>
        </div>
        <div className="print-admission">
          {qr ? (
            <img
              src={qr}
              width={116}
              height={116}
              alt={`Entrance QR for ${details.guestName}`}
            />
          ) : (
            <div className="print-qr-sample">
              {preview
                ? 'SAMPLE · Select a guest for their QR'
                : 'Contact your host for your entrance QR.'}
            </div>
          )}
          <div>
            <h2>For the usher</h2>
            <p>Present this QR at the entrance.</p>
            <p>
              Admits {details.capacity}{' '}
              {details.capacity === 1 ? 'person' : 'people'}
            </p>
            {details.tableLabel && <strong>{details.tableLabel}</strong>}
          </div>
        </div>
        <div className="print-notes">
          {design.dressCode && <p>Dress code: {design.dressCode}</p>}
          {e.kindNote && <p>{e.kindNote}</p>}
          {design.directions && <p>{design.directions}</p>}
          {design.programme && <p>{design.programme}</p>}
          {design.contact && <p>Contact: {design.contact}</p>}
        </div>
      </div>
    </article>
  );
}
