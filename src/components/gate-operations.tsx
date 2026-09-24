'use client';
import { useRef, useState } from 'react';
import {
  operationsCall,
  operationsSchema,
  OperationError,
  type OperationsCommand,
  type LookupGuest,
  type GateException,
} from '@/lib/operations';
export function GateOperations({
  eventId,
  userId,
  leaseId,
  role,
  gates,
}: {
  eventId: string;
  userId: string;
  leaseId: string;
  role: 'supervisor' | 'usher';
  gates: { id: string; name: string }[];
}) {
  const storageKey = `yingira-operation-pending:${userId}:${eventId}`;
  const [recovery] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return { intent: null, blocked: false };
      const parsed = operationsSchema.safeParse(JSON.parse(raw));
      if (
        !parsed.success ||
        parsed.data.eventId !== eventId ||
        !['movement', 'resolve_exception', 'request_exception'].includes(
          parsed.data.action,
        )
      )
        throw Error();
      return { intent: parsed.data, blocked: false };
    } catch {
      return { intent: null, blocked: true };
    }
  });
  const [gate, setGate] = useState(gates[0]?.id || ''),
    [search, setSearch] = useState(''),
    [guests, setGuests] = useState<LookupGuest[]>([]),
    [selected, setSelected] = useState<LookupGuest | null>(null),
    [quantity, setQuantity] = useState(1),
    [reason, setReason] = useState(''),
    [requests, setRequests] = useState<GateException[]>([]),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(
      recovery.blocked
        ? 'Saved operation cannot be read. Ask the Admin to review gate history before clearing this browser session.'
        : recovery.intent
          ? 'Recover the pending operation before recording another movement.'
          : '',
    ),
    [pending, setPending] = useState<OperationsCommand | null>(recovery.intent),
    [blocked] = useState(recovery.blocked);
  const lock = useRef(false);
  const context = { eventId, gateId: gate, leaseId };
  async function refresh() {
    setRequests(
      await operationsCall<GateException[]>({
        action: 'gate_state',
        ...context,
      }),
    );
  }
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus('');
    try {
      await fn();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Connection lost. Try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit(command: OperationsCommand) {
    sessionStorage.setItem(storageKey, JSON.stringify(command));
    setPending(command);
    try {
      const result = await operationsCall<{
        status?: string;
        insideCount?: number;
      }>(command);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setSelected(null);
      setGuests([]);
      setReason('');
      setStatus(
        result.insideCount !== undefined
          ? `Recorded. ${result.insideCount} people from this invitation are now inside.`
          : result.status
            ? `Request ${result.status}.`
            : 'Request sent to the supervisor.',
      );
      await refresh();
    } catch (e) {
      if (e instanceof OperationError && e.status < 500) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
      }
      throw e;
    }
  }
  function movement(kind: 'INITIAL_ENTRY' | 'EXIT' | 'REENTRY') {
    if (!selected) return;
    void run(() =>
      submit({
        action: 'movement',
        ...context,
        invitationId: selected.id,
        quantity,
        expectedVersion: selected.version,
        idempotencyKey: crypto.randomUUID(),
        deviceId: crypto.randomUUID(),
        reason,
        kind,
      }),
    );
  }
  return (
    <section className="panel gate-operations">
      <h2>Guest lookup & movements</h2>
      <p>
        Find a guest by name, last four phone digits, or invitation link. Verify
        their identity before recording a movement. Re-entry is only for people
        already recorded as having left.
      </p>
      {status && (
        <p role="status" className="notice">
          {status}
        </p>
      )}
      {pending && (
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void run(() => submit({ ...pending, leaseId } as OperationsCommand))
          }
        >
          Recover pending operation
        </button>
      )}
      <fieldset disabled={busy || !!pending || blocked}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              let term = search.trim();
              try {
                const url = new URL(term);
                if (url.origin !== window.location.origin) throw Error();
                const match = url.pathname.match(/^\/i\/([A-Za-z0-9_-]{43})$/);
                if (match) term = match[1];
              } catch {
                /* Names and phone suffixes are valid lookup terms. */
              }
              setGuests(
                await operationsCall<LookupGuest[]>({
                  action: 'lookup',
                  ...context,
                  search: term,
                }),
              );
              setSelected(null);
            });
          }}
        >
          <label>
            Gate for movements
            <select
              value={gate}
              onChange={(e) => {
                setGate(e.target.value);
                setGuests([]);
                setSelected(null);
              }}
            >
              {gates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Find guest at the gate
            <input
              value={search}
              minLength={2}
              maxLength={250}
              required
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className="button secondary">Find guest</button>
        </form>
        <div className="activity-list">
          {guests.map((g) => (
            <button
              className="lookup-result"
              key={g.id}
              type="button"
              onClick={() => {
                setSelected(g);
                setQuantity(1);
                setReason('');
              }}
            >
              <strong>{g.name}</strong>
              <span>
                {g.phoneSuffix
                  ? `Phone ending ${g.phoneSuffix}`
                  : 'No phone recorded'}{' '}
                · {g.tableLabel || 'Table unassigned'}
              </span>
              <span>
                {g.insideCount} inside · {g.initialCount}/{g.capacity} first
                entries{g.revoked ? ' · Revoked' : ''}
              </span>
            </button>
          ))}
        </div>
        {selected && (
          <div className="panel" aria-label="Selected gate guest">
            <h3>{selected.name}</h3>
            <p>
              {selected.tableLabel || 'Table unassigned'} ·{' '}
              {selected.capacity - selected.initialCount} first entries
              available · {selected.initialCount - selected.insideCount}{' '}
              eligible to re-enter
            </p>
            <label>
              Movement quantity
              <input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <label>
              Verification / exception reason
              <textarea
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="support-actions">
              <button
                type="button"
                className="button secondary"
                disabled={
                  selected.revoked ||
                  quantity < 1 ||
                  quantity > selected.insideCount
                }
                onClick={() => movement('EXIT')}
              >
                Record exit
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={
                  selected.revoked ||
                  quantity < 1 ||
                  quantity > selected.initialCount - selected.insideCount
                }
                onClick={() => movement('REENTRY')}
              >
                Record re-entry
              </button>
              {role === 'supervisor' ? (
                <button
                  type="button"
                  className="button"
                  disabled={
                    selected.revoked ||
                    reason.trim().length < 5 ||
                    quantity < 1 ||
                    quantity > selected.capacity - selected.initialCount
                  }
                  onClick={() => movement('INITIAL_ENTRY')}
                >
                  Confirm assisted first entry
                </button>
              ) : (
                <button
                  type="button"
                  className="button"
                  disabled={reason.trim().length < 5 || quantity < 1}
                  onClick={() =>
                    void run(() =>
                      submit({
                        action: 'request_exception',
                        ...context,
                        invitationId: selected.id,
                        requestId: crypto.randomUUID(),
                        quantity,
                        reason,
                      }),
                    )
                  }
                >
                  Ask supervisor
                </button>
              )}
            </div>
            <p>
              Capacity and revoked invitations cannot be bypassed. The Admin
              must explicitly correct invitation details when necessary.
            </p>
          </div>
        )}
        <div className="section-heading">
          <h3>
            {role === 'supervisor'
              ? 'Supervisor exception queue'
              : 'Your exception requests'}
          </h3>
          <button
            className="button secondary"
            onClick={() => void run(refresh)}
          >
            Refresh requests
          </button>
        </div>
        {requests.map((r) => (
          <div className="panel" key={r.id}>
            <strong>
              {r.name} · {r.quantity} people · {r.status}
            </strong>
            <p>{r.reason}</p>
            {role === 'supervisor' && r.status === 'pending' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(() =>
                    submit({
                      action: 'resolve_exception',
                      ...context,
                      invitationId: r.invitationId,
                      requestId: r.id,
                      quantity: r.quantity,
                      expectedVersion: r.version,
                      idempotencyKey: crypto.randomUUID(),
                      deviceId: crypto.randomUUID(),
                      decision: f.get('decision') as 'approve' | 'reject',
                      reason: String(f.get('reason')),
                    }),
                  );
                }}
              >
                <label>
                  Decision
                  <select name="decision">
                    <option value="approve">
                      Approve and record first entry
                    </option>
                    <option value="reject">Reject request</option>
                  </select>
                </label>
                <label>
                  Supervisor decision reason
                  <input name="reason" required minLength={5} maxLength={500} />
                </label>
                <button className="button">Record decision</button>
              </form>
            )}
          </div>
        ))}
      </fieldset>
    </section>
  );
}
