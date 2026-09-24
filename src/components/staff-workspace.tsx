'use client';
import { GateOperations } from './gate-operations';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { command } from './command-form';
import { ScannerClient } from './scanner-client';
import type {
  EventDetail,
  StaffRole,
  SupervisorOverview,
} from '@/lib/contracts';
import { signOut } from '@/app/auth/actions';
export function StaffWorkspace({
  event,
  userId,
  role,
  isAdmin,
  origin,
}: {
  event: Pick<EventDetail, 'id' | 'title' | 'venue' | 'status' | 'gates'>;
  userId: string;
  role: StaffRole;
  isAdmin: boolean;
  origin: string;
}) {
  const router = useRouter();
  const [leaseId, setLeaseId] = useState('');
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<SupervisorOverview | null>(null);
  const [scanning, setScanning] = useState(role === 'usher');
  const running = useRef(false);
  async function start() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      let currentLease = sessionStorage.getItem(`yingira-shift:${userId}`);
      if (!currentLease) {
        currentLease = crypto.randomUUID();
        sessionStorage.setItem(`yingira-shift:${userId}`, currentLease);
      }
      setLeaseId(currentLease);
      const r = await command<{ role: StaffRole }>({
        action: 'start_shift',
        eventId: event.id,
        leaseId: currentLease,
        role,
      });
      if (r.ok) setActive(true);
      else setError(r.message);
    } catch {
      setError(
        'Could not confirm the shift. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function end() {
    if (busy) return;
    if (
      sessionStorage.getItem(`yingira-pending:${userId}:${event.id}`) ||
      sessionStorage.getItem(`yingira-operation-pending:${userId}:${event.id}`)
    ) {
      setError(
        'Recover the pending admission or gate operation before ending your shift.',
      );
      setScanning(true);
      return;
    }
    setBusy(true);
    try {
      const r = await command({
        action: 'end_shift',
        eventId: event.id,
        leaseId,
      });
      if (r.ok || (!r.ok && r.code === 'SHIFT_REQUIRED')) {
        setActive(false);
        router.push(isAdmin ? `/events/${event.id}` : '/dashboard');
      } else setError(r.message);
    } catch {
      setError('Could not end your shift. Retry when online.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    async function refresh() {
      if (running.current) return;
      running.current = true;
      try {
        const r = await command({
          action: 'heartbeat_shift',
          eventId: event.id,
          leaseId,
        });
        if (disposed) return;
        if (!r.ok) {
          setActive(false);
          setError(r.message);
          return;
        }
        if (role === 'supervisor') {
          const summary = await command<SupervisorOverview>({
            action: 'supervisor_overview',
            eventId: event.id,
            leaseId,
          });
          if (!disposed) {
            if (summary.ok) setOverview(summary.data);
            else {
              setActive(false);
              setError(summary.message);
            }
          }
        }
      } catch {
        if (!disposed) {
          setActive(false);
          setError(
            'Connection lost. Your scanner is paused. Reconnect and resume your shift.',
          );
        }
      } finally {
        running.current = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 20000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [active, event.id, leaseId, role]);
  return (
    <main className="staff-workspace">
      <header className="staff-topbar">
        <Link className="brand" href="/dashboard">
          yingira.
        </Link>
        <span className="badge">
          {isAdmin ? 'Admin supporting · ' : ''}
          {role === 'supervisor' ? 'Supervisor' : 'Usher'}
        </span>
        {active ? (
          <button className="button secondary" disabled={busy} onClick={end}>
            End shift
          </button>
        ) : (
          <form action={signOut}>
            <button className="text-button">Sign out</button>
          </form>
        )}
      </header>
      <section className="staff-heading">
        <span className="eyebrow">
          {active ? 'ACTIVE SHIFT' : 'YOUR ASSIGNED EVENT'}
        </span>
        <h1>{event.title}</h1>
        <p>
          {event.venue} · {event.gates.map((g) => g.name).join(', ')}
        </p>
        {isAdmin && (
          <Link href={`/events/${event.id}`}>Back to Admin workspace</Link>
        )}
      </section>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!active ? (
        <section className="panel">
          <h2>
            {role === 'supervisor'
              ? 'Lead your welcome team.'
              : 'Ready to welcome guests?'}
          </h2>
          <p>
            {role === 'supervisor'
              ? 'Monitor arrivals and gate activity, or open the scanner to support your ushers.'
              : 'Scan the invitation, verify the guest, then confirm how many people enter.'}
          </p>
          <p>
            One active event/session per account. Your colleagues can work at
            the same event using their own accounts. End your shift before
            changing events or devices.
          </p>
          <button className="button" disabled={busy} onClick={start}>
            {busy ? 'Starting…' : `Start ${role} shift`}
          </button>
          <p>
            <Link href="/dashboard">All assigned events</Link>
          </p>
        </section>
      ) : (
        <>
          {role === 'supervisor' && (
            <section className="panel">
              <div className="section-heading">
                <h2>Event overview</h2>
                <button
                  className="button secondary"
                  onClick={() => setScanning(!scanning)}
                >
                  {scanning ? 'Show overview only' : 'Support with scanner'}
                </button>
              </div>
              {overview ? (
                <>
                  <div className="metrics">
                    {[
                      ['Invitations', overview.metrics.invitations],
                      ['Allowed people', overview.metrics.capacity],
                      ['People admitted', overview.metrics.admitted],
                      ['Estimated inside', overview.metrics.inside],
                    ].map(([label, value]) => (
                      <div className="metric" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <h3>Recent gate activity</h3>
                  <p className="muted">
                    Updates every 20 seconds. All times use your device
                    timezone.
                  </p>
                  <div className="activity-list">
                    {overview.recent.length ? (
                      overview.recent.map((r) => (
                        <div key={r.id}>
                          <strong>{r.guest_name}</strong>
                          <span>
                            {r.quantity}{' '}
                            {r.kind === 'EXIT'
                              ? 'exited'
                              : r.kind === 'REENTRY'
                                ? 're-entered'
                                : 'admitted'}{' '}
                            · {r.gate_name}
                          </span>
                          <time>
                            {new Date(r.accepted_at).toLocaleTimeString()}
                          </time>
                        </div>
                      ))
                    ) : (
                      <p>No arrivals yet.</p>
                    )}
                  </div>
                </>
              ) : (
                <p>Loading live arrivals…</p>
              )}
            </section>
          )}
          <GateOperations
            eventId={event.id}
            userId={userId}
            leaseId={leaseId}
            role={role}
            gates={event.gates}
          />
          {scanning && (
            <ScannerClient
              userId={userId}
              leaseId={leaseId}
              event={event}
              origin={origin}
            />
          )}
        </>
      )}
    </main>
  );
}
