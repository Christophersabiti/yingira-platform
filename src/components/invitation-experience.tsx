'use client';
/* eslint-disable @next/next/no-img-element */
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Download,
  Heart,
  MapPin,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { contrast, type Design } from '@/lib/planning';
import type { CardDetails } from './invitation-card';
import { InvitationFlowers } from './invitation-flowers';
import { programmeCalendar } from '@/lib/calendar';
import {
  invitationFilename,
  renderInvitation,
  saveInvitationBlob,
} from './invitation-export';

export function InvitationExperienceView({
  design,
  details,
  qr,
  photoUrls = {},
  response,
  link,
  eventId = 'preview',
  preview = false,
}: {
  design: Design;
  details: CardDetails;
  qr?: string;
  photoUrls?: Record<string, string>;
  response?: ReactNode;
  link?: string;
  eventId?: string;
  preview?: boolean;
}) {
  const e = design.experience;
  const envelope = useRef<HTMLDetailsElement>(null);
  const touchStart = useRef(0);
  const root = useRef<HTMLElement>(null);
  const welcome = useRef<HTMLHeadingElement>(null);
  const entrance = useRef<HTMLElement>(null);
  const [opened, setOpened] = useState(!e.envelope);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [downloading, setDownloading] = useState(false);
  const names = [design.groom, design.bride].filter(Boolean);
  const initials = e.seal || names.map((n) => n.trim()[0]).join(' & ') || '♡';
  const start = new Date(details.startsAt);
  const date = (options: Intl.DateTimeFormatOptions) =>
    start.toLocaleDateString('en-GB', {
      ...options,
      timeZone: details.timezone,
    });
  useEffect(() => {
    if (!e.showCountdown) return;
    const timer = setInterval(
      () =>
        setRemaining(
          Math.max(0, new Date(details.startsAt).getTime() - Date.now()),
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [details.startsAt, e.showCountdown]);
  useEffect(() => {
    if (
      !opened ||
      !root.current ||
      typeof IntersectionObserver === 'undefined' ||
      e.motion === 'none' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const elements =
      root.current.querySelectorAll<HTMLElement>('[data-unveil]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-unveiled');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    elements.forEach((el) => {
      el.classList.add('will-unveil');
      observer.observe(el);
    });
    return () => {
      observer.disconnect();
      elements.forEach((el) => el.classList.remove('will-unveil'));
    };
  }, [opened, e.motion, e.envelope]);
  const flowers = (className = '') => (
    <InvitationFlowers style={e.flowers} className={className} />
  );
  const photo = (id: string | null, alt: string, main = false) =>
    id && photoUrls[id] ? (
      <div className="inv-portrait">
        <img
          src={photoUrls[id]}
          alt={alt}
          loading={main ? 'eager' : 'lazy'}
          style={
            main
              ? {
                  objectPosition: `${design.photoX}% ${design.photoY}%`,
                  transform: `scale(${design.zoom}) rotate(${design.rotation}deg)`,
                }
              : undefined
          }
        />
      </div>
    ) : null;
  function calendar() {
    const item = {
      id: 'celebration',
      title: details.title,
      startsAt: details.startsAt,
      endsAt: new Date(start.getTime() + 3 * 3600000).toISOString(),
      location: e.receptionVenue || details.venue,
      owner: '',
      supplierId: null,
      notes: '',
      version: 1,
    };
    const text = programmeCalendar(eventId, details.title, [item]);
    saveInvitationBlob(
      new Blob([text], { type: 'text/calendar;charset=utf-8' }),
      'celebration.ics',
    );
  }
  async function download() {
    if (!link || downloading) return;
    setDownloading(true);
    setDownloadStatus('Preparing your invitation…');
    try {
      const blob = await renderInvitation({
        design,
        details,
        photoUrl: design.assetId ? photoUrls[design.assetId] : undefined,
        link,
        kind: 'png',
      });
      saveInvitationBlob(blob, `${invitationFilename(details.guestName)}.png`);
      setDownloadStatus('Invitation saved with your entrance QR.');
    } catch {
      setDownloadStatus('Download could not finish. Please try again.');
    } finally {
      setDownloading(false);
    }
  }
  const content = (
    <div className="inv-story">
      <nav className="inv-topbar" aria-label="Invitation shortcuts">
        <span>{names.join(' & ') || details.title}</span>
        <button
          type="button"
          onClick={() =>
            entrance.current?.scrollIntoView({
              behavior:
                e.motion === 'none' ||
                window.matchMedia('(prefers-reduced-motion: reduce)').matches
                  ? 'instant'
                  : 'smooth',
            })
          }
        >
          <QrCode size={16} /> Entrance QR
        </button>
      </nav>
      <section className="inv-welcome inv-section" data-unveil>
        {flowers()}
        <p className="inv-kicker">With love, an invitation for</p>
        <h1 ref={welcome} tabIndex={-1}>
          {details.guestName}
        </h1>
        <div className="inv-fine-rule" />
        <p className="inv-copy">
          {design.message || 'You are cordially invited to celebrate with us.'}
        </p>
        <p className="inv-kicker inv-scroll-hint">
          A beautiful day awaits <ArrowDown size={15} />
        </p>
      </section>
      {design.assetId && (
        <section className="inv-hero inv-section" data-unveil>
          <div className="inv-arch-frame">
            {flowers('inv-portrait-flowers')}
            {photo(design.assetId, 'Photograph chosen by the hosts', true)}
          </div>
        </section>
      )}
      <section className="inv-union inv-section" data-unveil>
        <p className="inv-kicker">
          {design.hosts || 'Together with our families'}
        </p>
        <p className="inv-copy">To share in the joy of the union of</p>
        <h2 className="inv-names">
          {names.length
            ? names.map((name, i) => (
                <span key={i}>
                  {i > 0 && <em>&</em>}
                  {name}
                </span>
              ))
            : details.title}
        </h2>
        {(e.brideAssetId || e.groomAssetId) && (
          <div className="inv-couple-portraits">
            {e.groomAssetId && (
              <figure>
                {photo(e.groomAssetId, design.groom || 'Groom portrait')}
                <figcaption>{design.groom}</figcaption>
              </figure>
            )}
            {e.brideAssetId && (
              <figure>
                {photo(e.brideAssetId, design.bride || 'Bride portrait')}
                <figcaption>{design.bride}</figcaption>
              </figure>
            )}
          </div>
        )}
        {flowers()}
        <p className="inv-kicker">{date({ weekday: 'long' })}</p>
        <div className="inv-date">
          <span>{date({ month: 'short' })}</span>
          <strong>{date({ day: '2-digit' })}</strong>
          <span>{date({ year: 'numeric' })}</span>
        </div>
        <p className="inv-timezone">{details.timezone.replaceAll('_', ' ')}</p>
      </section>
      <section className="inv-section inv-venues" data-unveil>
        <div className="inv-arch-frame inv-venue-frame">
          {flowers('inv-venue-flowers')}
          <div className="inv-venue-arch">
            {e.ceremonyVenue && (
              <>
                <Heart aria-hidden="true" size={30} />
                <p className="inv-kicker">The ceremony</p>
                <h3>{e.ceremonyVenue}</h3>
                {e.ceremonyTime && <p>{e.ceremonyTime}</p>}
                {e.ceremonyMap && (
                  <a
                    className="inv-map"
                    href={e.ceremonyMap}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ceremony directions <ArrowUpRight size={16} />
                  </a>
                )}
                <div className="inv-fine-rule" />
              </>
            )}
            <Sparkles aria-hidden="true" size={30} />
            <p className="inv-kicker">The celebration</p>
            <h3>{e.receptionVenue || details.venue}</h3>
            <p>
              {e.receptionTime ||
                start.toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: details.timezone,
                })}
            </p>
            {e.receptionMap && (
              <a
                className="inv-map"
                href={e.receptionMap}
                target="_blank"
                rel="noopener noreferrer"
              >
                Reception directions <ArrowUpRight size={16} />
              </a>
            )}
          </div>
        </div>
        {design.directions && (
          <p className="inv-copy inv-directions">
            <MapPin size={18} />
            {design.directions}
          </p>
        )}
        {design.dressCode && (
          <p className="inv-copy">Dress code · {design.dressCode}</p>
        )}
      </section>
      {design.programme && (
        <section className="inv-section" data-unveil>
          <p className="inv-kicker">The order of our day</p>
          <p className="inv-copy inv-preserve">{design.programme}</p>
        </section>
      )}
      {response && (
        <section className="inv-section inv-rsvp" data-unveil>
          {flowers()}
          <p className="inv-kicker">Will you be joining us?</p>
          {response}
        </section>
      )}
      {e.showCountdown && (
        <section className="inv-section" data-unveil>
          <p className="inv-kicker">
            {remaining === 0
              ? 'Our day has arrived'
              : 'Counting down to our day'}
          </p>
          <div className="inv-countdown" aria-label="Time until the event">
            {[86400000, 3600000, 60000, 1000].map((unit, i) => (
              <div key={unit}>
                <strong>
                  {remaining === null
                    ? '—'
                    : String(
                        Math.floor(remaining / unit) %
                          (i === 0 ? Infinity : i === 1 ? 24 : 60),
                      ).padStart(2, '0')}
                </strong>
                <span>{['Days', 'Hours', 'Minutes', 'Seconds'][i]}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {e.showCalendar && (
        <section className="inv-section inv-calendar" data-unveil>
          {flowers()}
          <h2>
            Save <em>the</em> date.
          </h2>
          <p className="inv-copy">Make a little room for a beautiful memory.</p>
          <button type="button" className="inv-button" onClick={calendar}>
            <CalendarDays size={17} /> Add to calendar
          </button>
        </section>
      )}
      {e.kindNote && (
        <section className="inv-section" data-unveil>
          <Heart size={26} className="inv-section-icon" />
          <p className="inv-kicker">A kind note</p>
          <p className="inv-copy inv-preserve">{e.kindNote}</p>
        </section>
      )}
      <section
        className="inv-section inv-admission"
        ref={entrance}
        tabIndex={-1}
        aria-label="Entrance admission"
      >
        <p className="inv-kicker">Your place in our celebration</p>
        <div className="inv-qr-frame">
          {flowers()}
          {qr ? (
            <img
              src={qr}
              width={240}
              height={240}
              alt={`Entrance QR for ${details.guestName}`}
            />
          ) : (
            <div className="inv-sample">
              <QrCode size={58} />
              <p>
                {preview
                  ? 'Sample · select a guest for their QR'
                  : 'Please contact your host for your entrance QR.'}
              </p>
            </div>
          )}
        </div>
        <p className="inv-admits">
          This card admits{' '}
          <strong>
            {details.capacity} {details.capacity === 1 ? 'guest' : 'guests'}
          </strong>
        </p>
        <div className="inv-fine-rule" />
        <p className="inv-copy">
          Please present this card at the entrance.
          <br />
          This invitation is non-transferable.
        </p>
        {details.tableLabel && (
          <p className="inv-table">{details.tableLabel}</p>
        )}
      </section>
      {link && (
        <section className="inv-section inv-download" data-unveil>
          <Download size={30} className="inv-section-icon" />
          <p className="inv-kicker">Keep it close</p>
          <p className="inv-copy">
            Save your invitation and entrance QR for easy access, even without
            internet.
          </p>
          <button
            type="button"
            className="inv-button inv-button-outline"
            disabled={downloading}
            onClick={() => void download()}
          >
            {downloading ? 'Preparing…' : 'Download invitation'}
          </button>
          <p role="status" className="inv-download-status">
            {downloadStatus}
          </p>
        </section>
      )}
      <footer className="inv-section inv-closing" data-unveil>
        {(e.closingAssetId || design.assetId) && (
          <div className="inv-closing-photo inv-arch-frame">
            {flowers()}
            {photo(
              e.closingAssetId || design.assetId,
              'Closing photograph chosen by the hosts',
            )}
          </div>
        )}
        <p className="inv-kicker">{names.join(' + ') || details.title}</p>
        <p className="inv-copy inv-preserve">{e.closingMessage}</p>
        {design.contact && (
          <p className="inv-contact">Contact · {design.contact}</p>
        )}
        {flowers('inv-footer-flowers')}
        <span className="inv-credit">
          With care, through <strong>yingira.</strong>
        </span>
      </footer>
    </div>
  );
  return (
    <article
      ref={root}
      className={`inv-experience inv-motion-${e.motion} ${preview ? 'inv-is-preview' : ''}`}
      style={
        {
          '--inv-paper': design.background,
          '--inv-ink': design.ink,
          '--inv-accent': design.accent,
          '--inv-envelope': e.envelopeColor,
          '--inv-envelope-ink':
            contrast(e.envelopeColor, '#fff9ee') >= 4.5 ? '#fff9ee' : '#202522',
          '--inv-envelope-muted':
            contrast(e.envelopeColor, '#e3caa3') >= 4.5
              ? '#e3caa3'
              : contrast(e.envelopeColor, '#fff9ee') >= 4.5
                ? '#fff9ee'
                : '#202522',
          '--inv-flower': e.flowerColor,
          '--inv-foliage': e.foliageColor,
          '--inv-heading-font':
            design.font === 'serif'
              ? 'Georgia, "Times New Roman", serif'
              : 'Arial, sans-serif',
        } as CSSProperties
      }
    >
      {e.envelope ? (
        <details
          ref={envelope}
          className="inv-envelope"
          onToggle={(event) => {
            const open = event.currentTarget.open;
            setOpened(open);
            if (open) welcome.current?.focus({ preventScroll: true });
          }}
        >
          <summary
            className="inv-cover"
            onWheel={(event) => {
              if (event.deltaY > 15 && envelope.current)
                envelope.current.open = true;
            }}
            onTouchStart={(event) => {
              touchStart.current = event.touches[0].clientY;
            }}
            onTouchEnd={(event) => {
              if (
                touchStart.current - event.changedTouches[0].clientY > 45 &&
                envelope.current
              )
                envelope.current.open = true;
            }}
            aria-label={e.openingLabel || 'Open your invitation'}
          >
            <div className="inv-cover-copy">
              <p className="inv-kicker">{e.coverSubtitle}</p>
              <h2>{e.coverTitle}</h2>
              <p className="inv-cover-names">
                {names.join(' & ') || details.title}
              </p>
            </div>
            <div className="inv-envelope-lining">{flowers()}</div>
            <div className="inv-envelope-flap" />
            <div className="inv-envelope-bottom" />
            <span className="inv-seal">{initials}</span>
            <span className="inv-open-label">
              {e.openingLabel || 'Open your invitation'}
              <ArrowDown size={20} />
              <small>For {details.guestName}</small>
            </span>
          </summary>
          {content}
        </details>
      ) : (
        content
      )}
    </article>
  );
}
