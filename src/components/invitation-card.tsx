'use client';
/* eslint-disable @next/next/no-img-element */
import { useLayoutEffect, useRef } from 'react';
import { fitPrintCard } from '@/lib/print-card-fit';
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
  qr,
  preview = false,
}: {
  design: Design;
  details: CardDetails;
  photoUrl?: string;
  qr?: string;
  preview?: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    let active = true;
    const fit = () => {
      if (active && cardRef.current) fitPrintCard(cardRef.current);
    };
    fit();
    void document.fonts.ready.then(fit);
    return () => {
      active = false;
    };
  });
  const names = [design.groom, design.bride].filter(Boolean);
  const e = design.experience;
  return (
    <article ref={cardRef} className="designed-card print-wedding-card">
      <div className="print-card-content">
        <p className="print-hosts">
          {design.hosts || 'Together with our families'}
        </p>
        <p className="print-recipient">Invites {details.guestName}</p>
        <p className="print-ceremony-intro">To the Wedding ceremony of:</p>
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
        <p className="print-date">
          {new Date(details.startsAt).toLocaleString('en-GB', {
            dateStyle: 'long',
            timeZone: details.timezone,
          })}
        </p>
        <div className="print-venues">
          {e.ceremonyVenue && (
            <section>
              <h2>Church</h2>
              <strong>{e.ceremonyVenue}</strong>
              {e.ceremonyTime && <p>{e.ceremonyTime}</p>}
            </section>
          )}
          <section>
            <h2>Reception</h2>
            <strong>{e.receptionVenue || details.venue}</strong>
            {e.receptionTime && <p>{e.receptionTime}</p>}
          </section>
        </div>
        {design.verse && <p className="print-verse">{design.verse}</p>}
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
            <h2>Guest entrance pass</h2>
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
          {design.guestNotice && <p>{design.guestNotice}</p>}
          {e.kindNote && <p>{e.kindNote}</p>}
          {design.directions && <p>{design.directions}</p>}
          {design.programme && <p>{design.programme}</p>}
          {design.contact && <p>Contact: {design.contact}</p>}
        </div>
      </div>
    </article>
  );
}
