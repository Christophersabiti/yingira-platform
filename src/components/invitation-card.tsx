/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react';
import type { Design } from '@/lib/planning';
export type CardDetails = {
  title: string;
  venue: string;
  startsAt: string;
  timezone: string;
  guestName: string;
  capacity: number;
  tableLabel: string;
};
export function InvitationCard({
  design,
  details,
  photoUrl,
  qr,
  preview = false,
}: {
  design: Design;
  details: CardDetails;
  photoUrl?: string;
  qr?: string;
  preview?: boolean;
}) {
  const names = [design.bride, design.groom].filter(Boolean).join(' & ');
  return (
    <article
      className={`designed-card design-${design.template} ${design.mode === 'artwork' ? 'design-artwork' : ''}`}
      style={
        {
          '--card-bg': design.background,
          '--card-ink': design.ink,
          '--card-accent': design.accent,
          fontFamily:
            design.font === 'serif' ? 'Georgia, serif' : 'Arial, sans-serif',
        } as CSSProperties
      }
    >
      {photoUrl && (
        <div className="design-photo">
          <img
            src={photoUrl}
            alt={
              design.mode === 'artwork'
                ? 'Uploaded invitation artwork'
                : 'Photograph chosen by the hosts'
            }
            style={{
              objectPosition: `${design.photoX}% ${design.photoY}%`,
              transform: `scale(${design.zoom}) rotate(${design.rotation}deg)`,
            }}
          />
        </div>
      )}
      <div className="design-content">
        <p className="design-hosts">
          {design.hosts || 'Together with our families'}
        </p>
        <span className="design-ornament" aria-hidden="true">
          {design.template === 'floral'
            ? '❀'
            : design.template === 'botanical'
              ? '❧'
              : '◇'}
        </span>
        <h1>{names || details.title}</h1>
        {names && <p className="design-event-title">{details.title}</p>}
        <p className="design-message">{design.message}</p>
        <div className="design-rule" />
        <p className="design-recipient">Dear {details.guestName},</p>
        <p>
          {new Date(details.startsAt).toLocaleString('en-GB', {
            dateStyle: 'long',
            timeStyle: 'short',
            timeZone: details.timezone,
          })}
        </p>
        <strong>{details.venue}</strong>
        {design.dressCode && <p>Dress code: {design.dressCode}</p>}
        <p>
          An invitation for {details.capacity}{' '}
          {details.capacity === 1 ? 'person' : 'people'}
        </p>
        {qr ? (
          <div className="design-qr">
            <img
              src={qr}
              width={144}
              height={144}
              alt={`Entrance QR for ${details.guestName}`}
            />
            <small>Present this QR at the entrance.</small>
          </div>
        ) : (
          <div className="design-sample">
            {preview
              ? 'SAMPLE · Select a guest for their QR'
              : 'Please contact your host for your entrance QR.'}
          </div>
        )}
        {details.tableLabel && <p>{details.tableLabel}</p>}
        {design.directions && (
          <p className="design-extra">{design.directions}</p>
        )}
        {design.programme && <p className="design-extra">{design.programme}</p>}
        {design.contact && (
          <p className="design-extra">Contact: {design.contact}</p>
        )}
        <small className="design-footer">With care, through yingira.</small>
      </div>
    </article>
  );
}
