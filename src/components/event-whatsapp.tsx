'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  whatsappCall,
  type WhatsAppCommand,
  type WhatsAppState,
} from '@/lib/whatsapp';
export function EventWhatsApp({
  initial,
  eventId,
  title,
}: {
  initial: WhatsAppState;
  eventId: string;
  title: string;
}) {
  const [data, setData] = useState(initial),
    [selected, setSelected] = useState<string[]>([]),
    [kind, setKind] = useState<'invitation' | 'reminder'>('invitation'),
    [date, setDate] = useState(''),
    [search, setSearch] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [preview, setPreview] = useState(false);
  const campaign = useRef<{
    signature: string;
    id: string;
    scheduledAt: string;
  } | null>(null);
  const eligible = data.guests.filter(
    (g) =>
      selected.includes(g.id) &&
      g.allowed &&
      !g.suppressed &&
      !g.revoked &&
      (kind !== 'reminder' || !g.responded),
  );
  const shown = data.guests.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );
  async function run(c: WhatsAppCommand) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const r = await whatsappCall<{ queued?: number; processed?: number }>(c);
      setData(await whatsappCall<WhatsAppState>({ action: 'state', eventId }));
      setMessage(
        r.queued !== undefined
          ? `${r.queued} messages scheduled.`
          : r.processed !== undefined
            ? `${r.processed} messages accepted by the provider.`
            : 'Saved.',
      );
      return true;
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Could not complete request.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href={`/events/${eventId}/plan`}>
        ← Planning workspace
      </Link>
      <span className="eyebrow">GUEST COMMUNICATION</span>
      <h1>Automated WhatsApp</h1>
      <p>{title}</p>
      <p role="status">{message}</p>
      {!data.configured ? (
        <p className="notice">
          WhatsApp Business is not connected. Record permission now; sending
          requires a Twilio WhatsApp sender and approved invitation/reminder
          templates.
        </p>
      ) : (
        <p>
          Connected sender: {data.sender}. Provider fees apply. Delivery is
          confirmed by signed provider callbacks.
        </p>
      )}
      <section className="panel">
        <h2>Recipient permission</h2>
        <p>
          Importing a phone number is not consent. Record when and how each
          guest agreed to WhatsApp event updates. STOP replies suppress further
          messages across this organization.
        </p>
        <label>
          Search WhatsApp recipients
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <div className="row-actions">
          <button
            className="button secondary"
            onClick={() =>
              setSelected(
                shown
                  .filter((g) => g.allowed && !g.suppressed && !g.revoked)
                  .slice(0, 500)
                  .map((g) => g.id),
              )
            }
          >
            Select eligible results
          </button>
          <button className="text-button" onClick={() => setSelected([])}>
            Clear selection
          </button>
        </div>
        {shown.map((g) => (
          <article className="plan-row" key={g.id}>
            <div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={selected.includes(g.id)}
                  disabled={!g.allowed || g.suppressed || g.revoked}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, g.id]
                        : selected.filter((id) => id !== g.id),
                    )
                  }
                />{' '}
                <strong>{g.name}</strong>
              </label>
              <p>
                {g.phone} ·{' '}
                {g.suppressed
                  ? 'Opted out via STOP'
                  : g.allowed
                    ? 'Permission recorded'
                    : 'No permission'}
                {g.responded ? ' · RSVP received' : ''}
                {g.revoked ? ' · Invitation revoked' : ''}
              </p>
              {g.evidence && <small>{g.evidence}</small>}
            </div>
            <button
              className="button secondary"
              disabled={busy || g.suppressed}
              onClick={() => {
                const evidence = window.prompt(
                  g.allowed
                    ? 'Reason permission is withdrawn (at least 8 characters)'
                    : 'When and how did this guest agree to WhatsApp updates? (at least 8 characters)',
                );
                if (evidence)
                  void run({
                    action: 'consent',
                    eventId,
                    invitationId: g.id,
                    allowed: !g.allowed,
                    evidence,
                  });
              }}
            >
              {g.allowed ? 'Withdraw permission' : 'Record permission'}
            </button>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Schedule an approved template</h2>
        <label>
          Message type
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setPreview(false);
            }}
          >
            <option value="invitation">Invitation</option>
            <option value="reminder">RSVP reminder (no response only)</option>
          </select>
        </label>
        <label>
          Send after (device timezone; leave blank for next dispatch)
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPreview(false);
            }}
          />
        </label>
        <p>
          {eligible.length} eligible recipients selected. Campaigns are limited
          to 500 guests. Dispatch checks run every minute, in batches of up to
          30; large batches may take several minutes.
        </p>
        <button
          className="button secondary"
          disabled={!eligible.length || eligible.length > 500}
          onClick={() => setPreview(true)}
        >
          Preview WhatsApp campaign
        </button>
        {preview && (
          <div className="message-preview">
            <h3>Campaign review</h3>
            <p>
              Send the provider-approved {kind} template to {eligible.length}{' '}
              guests using their name, “{title}” and their private invitation
              link. The exact wording is the approved template configured with
              your sender.
            </p>
            <p>
              Recipients:{' '}
              {eligible
                .slice(0, 10)
                .map((g) => g.name)
                .join(', ')}
              {eligible.length > 10 ? '…' : ''}
            </p>
            <p>
              {date
                ? `Queued for dispatch after ${new Date(date).toLocaleString()}`
                : 'Queued for the next dispatch'}
              . Permission, invitation validity and RSVP eligibility are checked
              again before dispatch.
            </p>
            <button
              disabled={
                busy ||
                !data.configured ||
                !eligible.length ||
                eligible.length > 500
              }
              onClick={async () => {
                const signature = JSON.stringify({
                  kind,
                  date,
                  ids: eligible.map((g) => g.id).sort(),
                });
                if (campaign.current?.signature !== signature)
                  campaign.current = {
                    signature,
                    id: crypto.randomUUID(),
                    scheduledAt: date
                      ? new Date(date).toISOString()
                      : new Date().toISOString(),
                  };
                if (
                  await run({
                    action: 'queue',
                    eventId,
                    campaignId: campaign.current.id,
                    kind,
                    guestIds: eligible.map((g) => g.id),
                    scheduledAt: campaign.current.scheduledAt,
                  })
                ) {
                  setPreview(false);
                  setSelected([]);
                  campaign.current = null;
                }
              }}
            >
              Confirm & schedule WhatsApp
            </button>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Delivery history</h2>
          <div className="row-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void run({ action: 'state', eventId })}
            >
              Refresh delivery history
            </button>
            <button
              disabled={busy || !data.configured}
              onClick={() => void run({ action: 'dispatch', eventId })}
            >
              Dispatch due messages now
            </button>
          </div>
        </div>
        <p>
          Accepted is not delivered. An uncertain request is not automatically
          retried: inspect the provider log first. Messages already in flight
          cannot be recalled.
        </p>
        {[
          ...new Set(
            data.messages
              .filter((m) => m.status === 'queued')
              .map((m) => m.campaignId),
          ),
        ].map((id) => (
          <button
            key={id}
            className="button secondary"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm('Cancel all unsent messages in this campaign?')
              )
                void run({ action: 'cancel', eventId, campaignId: id });
            }}
          >
            Cancel queued campaign {id.slice(0, 8)}
          </button>
        ))}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Message</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.messages.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.kind}</td>
                  <td>{new Date(m.scheduledAt).toLocaleString()}</td>
                  <td>{m.status}</td>
                  <td>{m.lastError || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.messages.length && <p>No WhatsApp messages scheduled yet.</p>}
      </section>
    </>
  );
}
