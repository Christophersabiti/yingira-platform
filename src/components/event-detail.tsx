'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Plus,
  ScanLine,
  Users,
} from 'lucide-react';
import type { EventDetail } from '@/lib/contracts';
import { CommandForm } from './command-form';
export function EventView({
  event,
  links,
}: {
  event: EventDetail;
  links: Record<string, string>;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false),
    [copied, setCopied] = useState(''),
    [tab, setTab] = useState('guests');
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <>
      <Link className="back-link" href="/dashboard">
        <ArrowLeft size={15} /> All events
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {event.isAdmin ? 'EVENT WORKSPACE' : 'EVENT TEAM'}
          </span>
          <h1>{event.title}</h1>
          <p>
            {new Date(event.startsAt).toLocaleString('en-GB', {
              dateStyle: 'long',
              timeStyle: 'short',
              timeZone: event.timezone,
            })}{' '}
            · {event.venue}
          </p>
        </div>
        <div className="support-actions">
          <Link className="button" href={`/work/${event.id}?role=supervisor`}>
            Work as supervisor
          </Link>
          <Link
            className="button secondary"
            href={`/work/${event.id}?role=usher`}
          >
            <ScanLine size={18} /> Work as usher
          </Link>
        </div>
      </div>
      <nav className="planning-nav" aria-label="Event planning">
        {event.isAdmin && (
          <Link className="button" href={`/events/${event.id}/plan`}>
            Plan event & billing
          </Link>
        )}
        <Link
          className="button secondary"
          href={`/events/${event.id}/operations`}
        >
          Responses, seating & email
        </Link>
        <Link className="button secondary" href={`/events/${event.id}/guests`}>
          Manage guests & bulk import
        </Link>
        <Link className="button secondary" href={`/events/${event.id}/studio`}>
          Invitation Studio
        </Link>
      </nav>
      <div className="event-status-row">
        <span className={`badge ${event.status === 'active' ? 'green' : ''}`}>
          {event.status === 'active'
            ? 'Check-in is open'
            : event.status === 'draft'
              ? 'Event in preparation'
              : 'Check-in closed'}
        </span>
        {event.isAdmin && (
          <CommandForm
            action="set_event_status"
            values={{
              eventId: event.id,
              status: event.status === 'active' ? 'closed' : 'active',
            }}
            label={
              event.status === 'active' ? 'Close check-in' : 'Open check-in'
            }
          />
        )}
        <span className="muted">All gates share one invitation capacity.</span>
      </div>
      {event.isAdmin ? (
        <>
          <div className="metrics">
            {[
              [
                'Invitations',
                event.metrics.invitations,
                'Individual invitation groups',
              ],
              [
                'Allowed people',
                event.metrics.capacity,
                'Across all invitations',
              ],
              [
                'People admitted',
                event.metrics.admitted,
                'Initial entries recorded',
              ],
              ['Estimated inside', event.metrics.inside, 'Entries minus exits'],
            ].map(([label, count, note]) => (
              <div className="metric" key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
                <small>{note}</small>
              </div>
            ))}
          </div>
          <div className="tabs">
            <button
              className={tab === 'guests' ? 'selected' : ''}
              onClick={() => setTab('guests')}
            >
              Guest list <span>{event.guests.length}</span>
            </button>
            <button
              className={tab === 'team' ? 'selected' : ''}
              onClick={() => setTab('team')}
            >
              Event team
            </button>
            <button
              className={tab === 'activity' ? 'selected' : ''}
              onClick={() => setTab('activity')}
            >
              Recent gate activity
            </button>
          </div>
          {tab === 'guests' && (
            <>
              <div className="section-heading">
                <div>
                  <h2>A welcome for everyone</h2>
                  <p className="muted">
                    Personal invitations, shared with care.
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() => setAdding(!adding)}
                >
                  <Plus size={16} />
                  {adding ? 'Close form' : 'Add guest'}
                </button>
              </div>
              {adding && (
                <section className="panel">
                  <CommandForm
                    action="create_guest"
                    values={{ eventId: event.id }}
                    numeric={['capacity']}
                    label="Create invitation"
                    onSuccess={() => setAdding(false)}
                  >
                    <div className="form-grid">
                      <label>
                        Guest name
                        <input
                          name="name"
                          required
                          minLength={2}
                          maxLength={160}
                          placeholder="Full name"
                        />
                      </label>
                      <label>
                        Phone number
                        <input
                          name="phone"
                          type="tel"
                          required
                          placeholder="+256700000001"
                        />
                      </label>
                      <label>
                        People allowed
                        <input
                          name="capacity"
                          type="number"
                          min={1}
                          max={100}
                          defaultValue={1}
                          required
                        />
                      </label>
                      <label>
                        Table / directions
                        <input
                          name="tableLabel"
                          maxLength={60}
                          placeholder="e.g. Table 12 · Family"
                        />
                      </label>
                    </div>
                  </CommandForm>
                </section>
              )}
              {event.guests.length === 0 ? (
                <div className="empty-state">
                  <Users size={32} />
                  <h2>Your guest list starts with one person.</h2>
                  <p>Add a guest to create their secure invitation.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Guest</th>
                        <th>People</th>
                        <th>Table / directions</th>
                        <th>Invitation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {event.guests.map((g) => (
                        <tr key={g.id}>
                          <td>
                            <strong>{g.name}</strong>
                            <small>•••• {g.phone_suffix}</small>
                          </td>
                          <td>
                            <strong>
                              {g.initial_count} / {g.capacity}
                            </strong>
                            <small>admitted</small>
                          </td>
                          <td>{g.table_label || 'Not assigned'}</td>
                          <td>
                            <div className="row-actions">
                              {links[g.id] && (
                                <>
                                  <a
                                    className="text-button"
                                    href={links[g.id]}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    View <ArrowUpRight size={14} />
                                  </a>
                                  <button
                                    className="icon-button"
                                    aria-label={`Copy invitation for ${g.name}`}
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(
                                          links[g.id],
                                        );
                                        setCopied(g.id);
                                      } catch {
                                        setCopied('');
                                      }
                                    }}
                                  >
                                    {copied === g.id ? (
                                      <Check size={16} />
                                    ) : (
                                      <Copy size={16} />
                                    )}
                                  </button>
                                </>
                              )}
                              {g.revoked || !links[g.id] ? (
                                <CommandForm
                                  action="reissue"
                                  values={{
                                    eventId: event.id,
                                    invitationId: g.id,
                                  }}
                                  label="Reissue"
                                />
                              ) : (
                                <CommandForm
                                  action="revoke"
                                  values={{
                                    eventId: event.id,
                                    invitationId: g.id,
                                  }}
                                  label="Revoke"
                                />
                              )}
                            </div>
                            {g.revoked && (
                              <small className="danger">Revoked</small>
                            )}
                            {!g.revoked && !links[g.id] && (
                              <small className="danger">
                                Saved link unavailable. Reissue creates a new QR
                                and invalidates the previous one.
                              </small>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {tab === 'team' && (
            <section className="panel">
              <h2>The people at the entrance.</h2>
              <p className="muted">
                Invite a person by email and choose their role and gate. They
                register and confirm that same email to receive access. Share
                the registration link below; invitation emails are not sent
                automatically.
              </p>
              <CommandForm
                action="assign_staff"
                values={{ eventId: event.id }}
                label="Invite or update team member"
              >
                <div className="form-grid">
                  <label>
                    Staff email
                    <input type="email" name="email" required />
                  </label>
                  <label>
                    Role
                    <select name="role" aria-label="Role">
                      <option value="usher">Entrance usher</option>
                      <option value="supervisor">Supervisor</option>
                    </select>
                  </label>
                  <label>
                    Gate
                    <select name="gateId" aria-label="Gate">
                      {event.gates.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </CommandForm>
              <p>
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `${window.location.origin}/register`,
                      );
                      setCopied('staff-invite');
                    } catch {
                      setCopied('');
                    }
                  }}
                >
                  {copied === 'staff-invite'
                    ? 'Registration link copied'
                    : 'Copy staff registration link'}
                </button>
              </p>
              <div className="team-list">
                {event.pendingStaff.map((s) => (
                  <div key={s.id}>
                    <div>
                      <strong>{s.email}</strong>
                      <small>
                        {s.role} · Waiting for verified registration
                      </small>
                    </div>
                    <CommandForm
                      action="cancel_staff_invitation"
                      values={{ eventId: event.id, invitationId: s.id }}
                      label="Cancel invitation"
                    />
                  </div>
                ))}
                {event.staff.map((s) => (
                  <div key={s.user_id}>
                    <div>
                      <strong>{s.email}</strong>
                      <small>
                        {s.role} · {s.gate_name} ·{' '}
                        {s.active ? 'Active' : 'Disabled'}
                      </small>
                    </div>
                    {s.on_shift && (
                      <CommandForm
                        action="release_staff_shift"
                        values={{ eventId: event.id, userId: s.user_id }}
                        label="End staff shift"
                      />
                    )}
                    {s.active && (
                      <CommandForm
                        action="disable_staff"
                        values={{ eventId: event.id, userId: s.user_id }}
                        label="Disable access"
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          {tab === 'activity' && (
            <section className="panel">
              <div className="section-heading">
                <h2>Recent gate activity</h2>
                <span className="live-label">Updates every 5 seconds</span>
              </div>
              {event.recent.length === 0 ? (
                <p className="muted">
                  The first successful admission will appear here.
                </p>
              ) : (
                <div className="activity-list">
                  {event.recent.map((r) => (
                    <div key={r.id}>
                      <span className="success-icon">
                        <Check size={16} />
                      </span>
                      <div>
                        <strong>{r.guest_name}</strong>
                        <small>
                          {r.quantity}{' '}
                          {r.kind === 'EXIT'
                            ? 'exited'
                            : r.kind === 'REENTRY'
                              ? 're-entered'
                              : 'admitted'}{' '}
                          · {r.gate_name}
                        </small>
                      </div>
                      <time>
                        {new Date(r.accepted_at).toLocaleTimeString('en-GB', {
                          timeZone: event.timezone,
                        })}
                      </time>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <section className="panel welcome-panel">
          <div>
            <h2>Ready to welcome your guests?</h2>
            <p>
              Open the scanner, select your assigned gate and verify each
              invitation before admitting anyone.
            </p>
          </div>
          <ScanLine size={64} />
        </section>
      )}
    </>
  );
}
