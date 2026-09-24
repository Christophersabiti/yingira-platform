'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  operationsCall,
  type OperationsCommand,
  type OperationsState,
} from '@/lib/operations';
import { csvText, downloadText } from '@/lib/planning';
import { HouseholdResponse } from './household-response';
export function EventOperations({
  eventId,
  title,
  initial,
  emailConfigured,
}: {
  eventId: string;
  title: string;
  initial: OperationsState;
  emailConfigured: boolean;
}) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState<'responses' | 'seating' | 'communication'>(
      'responses',
    ),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [editing, setEditing] = useState('');
  const [selected, setSelected] = useState<string[]>([]),
    [kind, setKind] = useState<'invitation' | 'reminder'>('invitation'),
    [subject, setSubject] = useState(`Your invitation: ${title}`),
    [message, setMessage] = useState(
      'We would love you to join us. Open your invitation below and let us know who will attend.',
    ),
    [preview, setPreview] = useState(false);
  const campaign = useRef<string | null>(null);
  const guests = data.guests.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' ||
        (filter === 'pending'
          ? g.responseRevision === 0
          : filter === 'yes'
            ? g.members.some((m) => m.response === 'yes')
            : g.responseRevision > 0 &&
              !g.members.some((m) => m.response === 'yes'))),
  );
  const edit = data.guests.find((g) => g.id === editing);
  const allowed = data.guests.filter(
    (g) =>
      selected.includes(g.id) &&
      g.email &&
      !g.revoked &&
      !g.suppressed &&
      (kind !== 'reminder' || !g.responseRevision),
  );
  async function refresh() {
    setData(
      await operationsCall<OperationsState>({ action: 'state', eventId }),
    );
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setStatus('');
    try {
      await fn();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }
  async function change(command: OperationsCommand) {
    await operationsCall(command);
    await refresh();
    setStatus('Saved.');
  }
  function seatingCsv() {
    return csvText([
      [
        'Table',
        'Household',
        'Places reserved',
        'Member',
        'Response',
        'Meal',
        'Dietary requirements',
      ],
      ...data.guests.flatMap((g) =>
        g.members.length
          ? g.members.map((m, index) => [
              g.tableLabel || 'Unassigned',
              g.name,
              index === 0 ? String(g.capacity) : '',
              m.name,
              m.response,
              m.meal,
              m.dietary,
            ])
          : [
              [
                g.tableLabel || 'Unassigned',
                g.name,
                String(g.capacity),
                '',
                'No response',
                '',
                '',
              ],
            ],
      ),
    ]);
  }
  return (
    <>
      <Link className="back-link" href={`/events/${eventId}`}>
        ← Event workspace
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{title}</span>
          <h1>Responses & event operations</h1>
          <p>Plan the people, their places and their welcome.</p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void run(refresh)}
        >
          Refresh
        </button>
      </div>
      <div className="support-actions" aria-label="Planning sections">
        {(['responses', 'seating', 'communication'] as const).map((t) => (
          <button
            key={t}
            className={`button ${tab === t ? '' : 'secondary'}`}
            onClick={() => {
              setTab(t);
              setPreview(false);
            }}
          >
            {t === 'responses'
              ? 'Household responses'
              : t === 'seating'
                ? 'Tables & seating'
                : 'Email invitations'}
          </button>
        ))}
      </div>
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
      <div className="metrics">
        <div className="metric">
          <span>Households responded</span>
          <strong>
            {data.guests.filter((g) => g.responseRevision).length} /{' '}
            {data.guests.length}
          </strong>
        </div>
        <div className="metric">
          <span>People attending</span>
          <strong>
            {data.guests.reduce(
              (n, g) =>
                n + g.members.filter((m) => m.response === 'yes').length,
              0,
            )}
          </strong>
        </div>
        <div className="metric">
          <span>Unassigned households</span>
          <strong>{data.guests.filter((g) => !g.tableId).length}</strong>
        </div>
      </div>
      {tab === 'responses' && (
        <section className="panel">
          <h2>Response settings</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(() =>
                change({
                  action: 'rsvp_settings',
                  eventId,
                  enabled: form.get('enabled') === 'on',
                  deadline: form.get('deadline')
                    ? new Date(String(form.get('deadline'))).toISOString()
                    : null,
                }),
              );
            }}
          >
            <label className="bulk-guest-option">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={data.rsvpEnabled}
              />
              Accept household responses
            </label>
            <label>
              Response deadline (your device’s timezone)
              <input
                type="datetime-local"
                name="deadline"
                defaultValue={
                  data.rsvpDeadline
                    ? new Date(
                        new Date(data.rsvpDeadline).getTime() -
                          new Date(data.rsvpDeadline).getTimezoneOffset() *
                            60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ''
                }
              />
            </label>
            <button className="button" disabled={busy}>
              Save response settings
            </button>
          </form>
          <p>
            Guests respond through their private invitation without creating an
            account. Admins can record a phone response after the deadline.
          </p>
        </section>
      )}
      {tab === 'seating' && (
        <section className="panel">
          <h2>Tables and capacities</h2>
          <p>
            Reserve the full invitation allowance for each household. RSVP edits
            cannot overbook a table. Existing free-text table labels remain
            visible until you assign a managed table.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget,
                v = new FormData(f);
              void run(async () => {
                await change({
                  action: 'table_save',
                  eventId,
                  tableId: null,
                  name: String(v.get('name')),
                  capacity: Number(v.get('capacity')),
                });
                f.reset();
              });
            }}
          >
            <div className="support-actions">
              <label>
                New table name
                <input name="name" required maxLength={60} />
              </label>
              <label>
                Table capacity
                <input
                  name="capacity"
                  type="number"
                  min={1}
                  max={1000}
                  required
                />
              </label>
              <button className="button" disabled={busy}>
                Create table
              </button>
            </div>
          </form>
          {data.tables.map((t) => (
            <form
              className="table-capacity-row"
              key={t.id}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(() =>
                  change({
                    action: 'table_save',
                    eventId,
                    tableId: t.id,
                    name: t.name,
                    capacity: Number(f.get('capacity')),
                  }),
                );
              }}
            >
              <strong>
                {t.name} · {t.reserved} reserved / {t.capacity}
              </strong>
              <label>
                Capacity for {t.name}
                <input
                  name="capacity"
                  type="number"
                  defaultValue={t.capacity}
                  min={Math.max(1, t.reserved)}
                  max={1000}
                />
              </label>
              <button className="button secondary" disabled={busy}>
                Update capacity
              </button>
            </form>
          ))}
          <div className="support-actions">
            <button
              className="button secondary"
              onClick={() => downloadText(seatingCsv(), 'yingira-seating.csv')}
            >
              Export seating & meal list
            </button>
            <button className="button secondary" onClick={() => window.print()}>
              Print seating list
            </button>
          </div>
        </section>
      )}
      {tab === 'communication' && (
        <section className="panel">
          <h2>Prepare invitations and reminders</h2>
          {!emailConfigured && (
            <p className="notice">
              Email sending is not connected. A verified sender address and
              provider API key are required before sending. You can still
              prepare and preview a message.
            </p>
          )}
          <fieldset disabled={busy}>
            <label>
              Message type
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as typeof kind);
                  setPreview(false);
                  campaign.current = null;
                }}
              >
                <option value="invitation">Invitation</option>
                <option value="reminder">
                  Reminder — households with no response
                </option>
              </select>
            </label>
            <label>
              Email subject
              <input
                maxLength={160}
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setPreview(false);
                  campaign.current = null;
                }}
              />
            </label>
            <label>
              Email message
              <textarea
                maxLength={2000}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setPreview(false);
                  campaign.current = null;
                }}
              />
            </label>
            <p>
              Each guest receives a separate email with their own private
              invitation link. Delivery is tracked separately from RSVP.
              Provider charges depend on your email plan.
            </p>
            <button
              type="button"
              className="button secondary"
              disabled={!allowed.length || !subject.trim() || !message.trim()}
              onClick={() => setPreview(true)}
            >
              Preview {allowed.length} emails
            </button>
          </fieldset>
          {preview && (
            <div className="message-preview">
              <h3>{subject}</h3>
              <p>Dear {allowed[0]?.name},</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
              <p>
                {title}
                <br />
                [Event date and venue]
                <br />
                [This guest’s private invitation and response link]
              </p>
              <p>
                {allowed.length} eligible recipients selected. Missing email,
                revoked, suppressed and already-responded reminder recipients
                are excluded.
              </p>
              <button
                className="button"
                disabled={busy || !emailConfigured || !allowed.length}
                onClick={() =>
                  void run(async () => {
                    if (!campaign.current)
                      campaign.current = crypto.randomUUID();
                    const result = await operationsCall<{ queued: number }>({
                      action: 'queue_mail',
                      eventId,
                      campaignId: campaign.current,
                      kind,
                      subject,
                      message,
                      guestIds: allowed.map((g) => g.id),
                    });
                    await refresh();
                    setPreview(false);
                    setStatus(
                      `${result.queued} emails queued. Click Send queued emails to send the next batch.`,
                    );
                  })
                }
              >
                Confirm queue of {allowed.length} emails
              </button>
            </div>
          )}
          <div className="support-actions">
            <button
              className="button"
              disabled={busy || !emailConfigured}
              onClick={() =>
                void run(async () => {
                  const r = await operationsCall<{ processed: number }>({
                    action: 'process_mail',
                    eventId,
                  });
                  await refresh();
                  setStatus(
                    `${r.processed} accepted by the provider. Send again for remaining batches; uncertain requests can be retried after two minutes.`,
                  );
                })
              }
            >
              Send queued emails
            </button>
            <button
              className="button secondary"
              disabled={busy || !emailConfigured}
              onClick={() =>
                void run(async () => {
                  await operationsCall({ action: 'track_mail', eventId });
                  await refresh();
                  setStatus(
                    'Delivery tracking refreshed. Accepted means provider accepted, not delivered.',
                  );
                })
              }
            >
              Refresh delivery tracking
            </button>
          </div>
        </section>
      )}
      <section className="panel">
        <div className="support-actions">
          <label>
            Find household
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            Response filter
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All households</option>
              <option value="pending">No response</option>
              <option value="yes">Some attending</option>
              <option value="no">All declined</option>
            </select>
          </label>
          {tab === 'communication' && (
            <>
              <button
                className="text-button"
                onClick={() => {
                  setSelected(guests.map((g) => g.id));
                  setPreview(false);
                  campaign.current = null;
                }}
              >
                Select matching households
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setSelected([]);
                  setPreview(false);
                  campaign.current = null;
                }}
              >
                Clear selection
              </button>
            </>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {tab === 'communication' && <th>Select</th>}
                <th>Household</th>
                <th>Response</th>
                <th>Places</th>
                <th>Table</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.id}>
                  {tab === 'communication' && (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Email ${g.name}`}
                        checked={selected.includes(g.id)}
                        disabled={!g.email || g.revoked || g.suppressed}
                        onChange={(e) => {
                          setSelected((ids) =>
                            e.target.checked
                              ? [...ids, g.id]
                              : ids.filter((id) => id !== g.id),
                          );
                          setPreview(false);
                          campaign.current = null;
                        }}
                      />
                    </td>
                  )}
                  <td>
                    {g.name}
                    {tab === 'communication' && (
                      <small className="block">
                        {g.email || 'No email'}
                        {g.suppressed ? ' · Suppressed' : ''}
                      </small>
                    )}
                  </td>
                  <td>
                    {g.responseRevision
                      ? `${g.members.filter((m) => m.response === 'yes').length} attending / ${g.members.length} named`
                      : 'No response'}
                  </td>
                  <td>{g.capacity}</td>
                  <td>
                    {tab === 'seating' ? (
                      <select
                        aria-label={`Table for ${g.name}`}
                        disabled={busy}
                        value={g.tableId || ''}
                        onChange={(e) =>
                          void run(() =>
                            change({
                              action: 'assign_table',
                              eventId,
                              invitationId: g.id,
                              tableId: e.target.value || null,
                              expectedVersion: g.version,
                            }),
                          )
                        }
                      >
                        <option value="">
                          Unassigned
                          {!g.tableId && g.tableLabel
                            ? ` (${g.tableLabel})`
                            : ''}
                        </option>
                        {data.tables.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} · {t.capacity - t.reserved} free
                          </option>
                        ))}
                      </select>
                    ) : (
                      g.tableLabel || 'Unassigned'
                    )}
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setEditing(g.id)}
                    >
                      Record response
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {edit && (
        <section className="panel" aria-label="Record household response">
          <h2>{edit.name}</h2>
          <button className="text-button" onClick={() => setEditing('')}>
            Close response editor
          </button>
          <HouseholdResponse
            key={edit.id + ':' + edit.responseRevision}
            capacity={edit.capacity}
            initial={edit.members}
            revision={edit.responseRevision}
            onSave={async (members, expectedRevision) => {
              const r = await operationsCall<{ revision: number }>({
                action: 'admin_response',
                eventId,
                invitationId: edit.id,
                members,
                expectedRevision,
              });
              await refresh();
              return r;
            }}
          />
        </section>
      )}
      {tab === 'communication' && (
        <section className="panel">
          <h2>Delivery history</h2>
          <p>
            Latest 500 messages. Bounce and complaint recipients are suppressed
            from further sends.
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
              className="text-button"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  change({ action: 'cancel_mail', eventId, campaignId: id }),
                )
              }
            >
              Cancel queued batch {id.slice(0, 8)}
            </button>
          ))}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.messages.map((m) => (
                  <tr key={m.id}>
                    <td>{m.guestName}</td>
                    <td>{m.subject}</td>
                    <td>
                      {m.status}
                      {m.lastError && (
                        <small className="block">{m.lastError}</small>
                      )}
                    </td>
                    <td>{new Date(m.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="print-seating">
        <h1>{title} — seating list</h1>
        {data.tables.map((t) => (
          <div key={t.id}>
            <h2>
              {t.name} · {t.reserved}/{t.capacity} reserved
            </h2>
            {data.guests
              .filter((g) => g.tableId === t.id)
              .map((g) => (
                <p key={g.id}>
                  {g.name} — {g.capacity} places
                  {g.members.length
                    ? ` · ${g.members
                        .filter((m) => m.response === 'yes')
                        .map((m) => m.name)
                        .join(', ')}`
                    : ''}
                </p>
              ))}
          </div>
        ))}
        <h2>Unassigned households</h2>
        {data.guests
          .filter((g) => !g.tableId)
          .map((g) => (
            <p key={g.id}>
              {g.name} — {g.capacity} places
            </p>
          ))}
      </section>
    </>
  );
}
