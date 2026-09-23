'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { InvitationCard, type CardDetails } from './invitation-card';
import {
  defaultDesign,
  designSchema,
  templates,
  planningCall,
  contrast,
  type Design,
  type PlanningData,
} from '@/lib/planning';
export function InvitationStudio({
  eventId,
  event,
  initial,
  links,
  selectedGuest,
}: {
  eventId: string;
  event: Omit<CardDetails, 'guestName' | 'capacity' | 'tableLabel'>;
  initial: PlanningData;
  links: Record<string, string>;
  selectedGuest?: string;
}) {
  const [design, setDesign] = useState<Design>(
      designSchema.safeParse(initial.draft).success
        ? initial.draft!
        : defaultDesign,
    ),
    [revision, setRevision] = useState(initial.revision),
    [versions, setVersions] = useState(initial.versions),
    [published, setPublished] = useState(initial.publishedId),
    [dirty, setDirty] = useState(false),
    [autoPaused, setAutoPaused] = useState(false),
    [status, setStatus] = useState('Draft loaded'),
    [busy, setBusy] = useState(false),
    [guestId, setGuestId] = useState(selectedGuest || ''),
    [qrResult, setQr] = useState({ link: '', image: '' }),
    [past, setPast] = useState<Design[]>([]),
    [future, setFuture] = useState<Design[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  const changeCounter = useRef(0);
  const currentRevision = useRef(initial.revision);
  const guest = initial.guests.find((g) => g.id === guestId);
  const link = links[guestId];
  const qr = qrResult.link === link ? qrResult.image : '';
  useEffect(() => {
    let active = true;
    if (link)
      QRCode.toDataURL(link, {
        width: 360,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      }).then((v) => {
        if (active) setQr({ link, image: v });
      });
    return () => {
      active = false;
    };
  }, [link]);
  function change(next: Design) {
    setPast((p) => [...p.slice(-19), design]);
    setFuture([]);
    setDesign(next);
    changeCounter.current++;
    setDirty(true);
    setAutoPaused(false);
    setStatus('Unsaved changes');
  }
  async function save() {
    if (saving.current) return null;
    saving.current = true;
    const counter = changeCounter.current;
    setStatus('Saving draft…');
    try {
      const result = await planningCall<{ revision: number }>({
        action: 'save_design',
        eventId,
        expectedRevision: currentRevision.current,
        design: designSchema.parse(design),
      });
      currentRevision.current = result.revision;
      setRevision(result.revision);
      if (counter === changeCounter.current) setDirty(false);
      setStatus('Draft saved');
      return result.revision;
    } catch (e) {
      setAutoPaused(true);
      setStatus(e instanceof Error ? e.message : 'Save failed');
      return null;
    } finally {
      saving.current = false;
    }
  }
  useEffect(() => {
    if (!dirty || autoPaused || busy) return;
    const timer = setTimeout(() => {
      void save();
    }, 1600);
    return () => clearTimeout(timer);
  });
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }
  const photoUrl = design.assetId
    ? `/api/planning/assets?eventId=${eventId}&assetId=${design.assetId}`
    : undefined;
  async function download(kind: 'png' | 'pdf') {
    if (!cardRef.current) return;
    if (guestId && !link)
      throw Error(
        'This invitation is revoked or its link is unavailable. Reissue it before exporting.',
      );
    setStatus('Preparing your download…');
    await document.fonts.ready;
    await Promise.all(
      Array.from(cardRef.current.querySelectorAll('img')).map((img) =>
        img.decode(),
      ),
    );
    const { toPng } = await import('html-to-image');
    const png = await toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: false,
      backgroundColor: design.background,
    });
    const filename = `yingira-${guest ? guest.name.replace(/[^\p{L}\p{N}]+/gu, '-') : 'sample'}`;
    if (kind === 'png') {
      const a = document.createElement('a');
      a.download = filename + '.png';
      a.href = png;
      a.click();
    } else {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: [127, 177.8] });
      const ratio = cardRef.current.offsetHeight / cardRef.current.offsetWidth;
      const width = Math.min(117, 167.8 / ratio);
      if (guest && (width * 144) / cardRef.current.offsetWidth < 20)
        throw Error(
          'This card is too long for a scannable 5×7 print. Shorten the message or programme, or download PNG instead.',
        );
      pdf.addImage(
        png,
        'PNG',
        (127 - width) / 2,
        (177.8 - width * ratio) / 2,
        width,
        width * ratio,
      );
      pdf.save(filename + '.pdf');
    }
    setStatus(
      'Downloaded. Printed cards do not update when the design changes.',
    );
  }
  return (
    <>
      <Link className="back-link" href={`/events/${eventId}`}>
        ← Event workspace
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">INVITATION STUDIO · {event.title}</span>
          <h1>Make it yours.</h1>
          <p>
            Names, photographs and colours. One design, a personal welcome for
            every guest.
          </p>
        </div>
      </div>
      <p className="notice" role="status">
        {status} · revision {revision}
        {published ? ' · A design is live' : ' · Not published'}
      </p>
      <div className="studio-layout">
        <section className="panel studio-controls">
          <details>
            <summary>Event date and venue</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const values = Object.fromEntries(
                  new FormData(e.currentTarget),
                );
                void task(async () => {
                  await planningCall({
                    action: 'save_event',
                    eventId,
                    ...values,
                    startsAt: new Date(String(values.startsAt)).toISOString(),
                  });
                  window.location.reload();
                });
              }}
            >
              <label>
                Event title
                <input
                  name="title"
                  defaultValue={event.title}
                  required
                  minLength={2}
                  maxLength={160}
                />
              </label>
              <label>
                Venue
                <input
                  name="venue"
                  defaultValue={event.venue}
                  required
                  minLength={2}
                  maxLength={160}
                />
              </label>
              <label>
                Date and time (your device’s timezone)
                <input
                  type="datetime-local"
                  name="startsAt"
                  defaultValue={new Date(
                    new Date(event.startsAt).getTime() -
                      new Date(event.startsAt).getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)}
                  required
                />
              </label>
              <label>
                Display timezone
                <input name="timezone" defaultValue={event.timezone} required />
              </label>
              <p>
                Saving updates event details on existing online invitations
                immediately.
              </p>
              <button className="button secondary" disabled={busy || dirty}>
                Save event details
              </button>
            </form>
          </details>
          <fieldset disabled={busy}>
            <legend>Design your invitation</legend>
            <label>
              Starting point
              <select
                value={design.mode}
                onChange={(e) =>
                  change({ ...design, mode: e.target.value as Design['mode'] })
                }
              >
                <option value="template">Editable Yingira template</option>
                <option value="artwork">Upload finished artwork</option>
              </select>
            </label>
            {design.mode === 'artwork' && (
              <p>
                Artwork is an image. Text inside it cannot be edited here; guest
                names and the QR remain a separate panel.
              </p>
            )}
            <div className="template-grid">
              {templates.map((t) => (
                <button
                  type="button"
                  className={`template-choice ${design.template === t.id ? 'selected' : ''}`}
                  key={t.id}
                  onClick={() =>
                    change({
                      ...design,
                      template: t.id,
                      background: t.background,
                      ink: t.ink,
                      accent: t.accent,
                    })
                  }
                >
                  <span
                    className="template-swatch"
                    style={{
                      background: t.background,
                      color: t.ink,
                      borderColor: t.accent,
                    }}
                  >
                    A & B
                  </span>
                  <strong>{t.name}</strong>
                  <small>{t.description}</small>
                </button>
              ))}
            </div>
            <details open>
              <summary>Names and message</summary>
              {(
                [
                  'bride',
                  'groom',
                  'hosts',
                  'message',
                  'dressCode',
                  'directions',
                  'contact',
                  'programme',
                ] as const
              ).map((key) => (
                <label key={key}>
                  {
                    {
                      bride: 'Bride / first host',
                      groom: 'Groom / second host',
                      hosts: 'Families / hosts',
                      message: 'Invitation message',
                      dressCode: 'Dress code',
                      directions: 'Directions',
                      contact: 'Host contact',
                      programme: 'Programme',
                    }[key]
                  }
                  <textarea
                    rows={key === 'message' || key === 'programme' ? 3 : 1}
                    maxLength={
                      key === 'message' || key === 'programme'
                        ? 500
                        : key === 'directions'
                          ? 300
                          : key === 'hosts'
                            ? 200
                            : key === 'contact'
                              ? 160
                              : 100
                    }
                    value={design[key]}
                    onChange={(e) =>
                      change({ ...design, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <p>
                Date, time and venue come from the event. Guest names and
                allowances come from the guest list.
              </p>
            </details>
            <details open>
              <summary>Photo / artwork</summary>
              <label>
                Upload JPEG, PNG or WebP (up to 4 MB)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Couple photo or artwork"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    void task(async () => {
                      if (f.size > 4_000_000)
                        throw Error('Image must be under 4 MB.');
                      const r = await fetch(
                        `/api/planning/assets?eventId=${eventId}`,
                        { method: 'POST', body: f },
                      );
                      const d = await r.json();
                      if (!r.ok) throw Error(d.message);
                      change({
                        ...design,
                        assetId: d.id,
                        photoX: 50,
                        photoY: 50,
                        zoom: 1,
                        rotation: 0,
                      });
                      setStatus(
                        d.lowResolution
                          ? 'Photo added. Resolution may be low for printing.'
                          : 'Photo added. Saving draft…',
                      );
                    });
                  }}
                />
              </label>
              {design.assetId && (
                <>
                  {(['photoX', 'photoY', 'zoom', 'rotation'] as const).map(
                    (k) => (
                      <label key={k}>
                        {
                          {
                            photoX: 'Horizontal position',
                            photoY: 'Vertical position',
                            zoom: 'Zoom / crop',
                            rotation: 'Rotate',
                          }[k]
                        }
                        <input
                          type="range"
                          min={k === 'zoom' ? 1 : k === 'rotation' ? -180 : 0}
                          max={k === 'zoom' ? 3 : k === 'rotation' ? 180 : 100}
                          step={k === 'zoom' ? 0.05 : 1}
                          value={design[k]}
                          onChange={(e) =>
                            change({ ...design, [k]: Number(e.target.value) })
                          }
                        />
                      </label>
                    ),
                  )}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      change({
                        ...design,
                        photoX: 50,
                        photoY: 50,
                        zoom: 1,
                        rotation: 0,
                      })
                    }
                  >
                    Reset crop
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => change({ ...design, assetId: null })}
                  >
                    Remove photo
                  </button>
                </>
              )}
            </details>
            <details>
              <summary>Colours and type</summary>
              {(['background', 'ink', 'accent'] as const).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    type="color"
                    value={design[k]}
                    onChange={(e) => change({ ...design, [k]: e.target.value })}
                  />
                </label>
              ))}
              <label>
                Typography
                <select
                  value={design.font}
                  onChange={(e) =>
                    change({
                      ...design,
                      font: e.target.value as Design['font'],
                    })
                  }
                >
                  <option value="serif">Classic serif</option>
                  <option value="sans">Modern sans serif</option>
                </select>
              </label>
              {contrast(design.background, design.ink) < 4.5 && (
                <p className="notice error">
                  Text contrast is too low. Choose darker text or a lighter
                  background before publishing.
                </p>
              )}
            </details>
            <div className="support-actions">
              <button
                type="button"
                className="button secondary"
                disabled={!past.length}
                onClick={() => {
                  const prev = past[past.length - 1];
                  setFuture((f) => [design, ...f]);
                  setPast((p) => p.slice(0, -1));
                  setDesign(prev);
                  changeCounter.current++;
                  setDirty(true);
                }}
              >
                Undo
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={!future.length}
                onClick={() => {
                  setPast((p) => [...p, design]);
                  setDesign(future[0]);
                  setFuture((f) => f.slice(1));
                  changeCounter.current++;
                  setDirty(true);
                }}
              >
                Redo
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => change({ ...defaultDesign })}
              >
                Reset design
              </button>
            </div>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void task(async () => {
                  await save();
                })
              }
            >
              Save draft
            </button>
            <button
              className="button"
              disabled={busy || contrast(design.background, design.ink) < 4.5}
              onClick={() =>
                void task(async () => {
                  const rev =
                    dirty || !currentRevision.current
                      ? await save()
                      : currentRevision.current;
                  if (rev === null)
                    throw Error('Wait for the draft to finish saving.');
                  if (
                    !window.confirm(
                      `Publish this design for ${event.title}? Existing online invitations will update; downloaded cards will not.`,
                    )
                  )
                    return;
                  const r = await planningCall<{ revision: number }>({
                    action: 'publish_design',
                    eventId,
                    expectedRevision: rev,
                  });
                  currentRevision.current = r.revision;
                  setRevision(r.revision);
                  const data = await planningCall<PlanningData>({
                    action: 'state',
                    eventId,
                  });
                  setVersions(data.versions);
                  setPublished(data.publishedId);
                  setStatus(
                    'Published. Existing QR codes and admissions are unchanged.',
                  );
                })
              }
            >
              Publish design
            </button>
          </fieldset>
          <details>
            <summary>Published versions</summary>
            {versions.map((v) => (
              <div className="job-row" key={v.id}>
                <span>
                  {new Date(v.createdAt).toLocaleString()}
                  {v.id === published ? ' · Live' : ''}
                </span>
                <button
                  className="text-button"
                  disabled={busy || dirty}
                  onClick={() =>
                    void task(async () => {
                      const r = await planningCall<{ revision: number }>({
                        action: 'restore_design',
                        eventId,
                        versionId: v.id,
                        expectedRevision: currentRevision.current,
                      });
                      currentRevision.current = r.revision;
                      setRevision(r.revision);
                      setDesign(designSchema.parse(v.design));
                      setDirty(false);
                      setStatus(
                        'Version restored to draft. Publish to make it live.',
                      );
                    })
                  }
                >
                  Restore to draft
                </button>
              </div>
            ))}
          </details>
        </section>
        <section className="studio-preview">
          <div className="panel">
            <label>
              Preview for
              <select
                value={guestId}
                onChange={(e) => setGuestId(e.target.value)}
              >
                <option value="">Sample guest (no entrance QR)</option>
                {initial.guests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.revoked ? ' · Revoked' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="support-actions">
              <button
                className="button secondary"
                disabled={busy || (!!guestId && !qr)}
                onClick={() => void task(() => download('png'))}
              >
                Download PNG
              </button>
              <button
                className="button secondary"
                disabled={busy || (!!guestId && !qr)}
                onClick={() => void task(() => download('pdf'))}
              >
                Download 5×7 PDF
              </button>
            </div>
            <p>
              Preview uses your current draft. Publish before sharing links.
              Keep downloaded guest cards private.
            </p>
          </div>
          <div className="card-preview-scroll">
            <div ref={cardRef} className="card-export">
              <InvitationCard
                design={design}
                details={{
                  ...event,
                  guestName: guest?.name || 'Your guest',
                  capacity: guest?.capacity || 2,
                  tableLabel: guest?.tableLabel || '',
                }}
                photoUrl={photoUrl}
                qr={qr}
                preview
              />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
