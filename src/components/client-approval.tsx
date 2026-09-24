'use client';
import { useRef, useState } from 'react';
import Image from 'next/image';
import { money, type ApprovalView } from '@/lib/commerce';
export function ClientApproval({
  initial,
  token,
}: {
  initial: ApprovalView;
  token: string;
}) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const s = data.snapshot;
  const b = s.brand;
  return (
    <main className="client-portal" style={{ borderTopColor: b.color }}>
      <header className="client-brand">
        {b.logoAssetId && (
          <Image
            src={`/api/brand?approval=${token}`}
            alt={`${b.name} logo`}
            width={100}
            height={80}
            unoptimized
          />
        )}
        <div>
          <strong style={{ color: b.color }}>{b.name}</strong>
          <p>{b.tagline}</p>
        </div>
      </header>
      <span className="eyebrow">PRIVATE CLIENT REVIEW</span>
      <h1>{data.title}</h1>
      <p>
        {data.eventTitle} · Prepared for {data.clientName}
      </p>
      <p className="muted">
        Snapshot shared {new Date(data.createdAt).toLocaleString('en-GB')}.
        Changes made later by your planner are not included here.
      </p>
      {s.details && <p className="preserve-lines">{s.details}</p>}
      {s.budget && (
        <section>
          <h2>Budget · {s.currency}</h2>
          <p>
            Target: {money(s.budget.budget, s.currency)} · Committed:{' '}
            {money(s.budget.committed, s.currency)}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Planned</th>
                  <th>Quoted</th>
                  <th>Committed</th>
                </tr>
              </thead>
              <tbody>
                {s.budget.costs.map((c, i) => (
                  <tr key={i}>
                    <td>{c.title}</td>
                    <td>{money(c.planned, s.currency)}</td>
                    <td>{money(c.quoted, s.currency)}</td>
                    <td>{money(c.committed, s.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {s.programme && (
        <section>
          <h2>Programme</h2>
          {s.programme.map((p) => (
            <article className="plan-row" key={p.id}>
              <strong>{p.title}</strong>
              <p>
                {new Date(p.startsAt).toLocaleString('en-GB', {
                  timeZone: 'Africa/Kampala',
                })}{' '}
                –{' '}
                {new Date(p.endsAt).toLocaleTimeString('en-GB', {
                  timeZone: 'Africa/Kampala',
                })}{' '}
                EAT
              </p>
              <p>
                {p.location} · {p.owner}
              </p>
            </article>
          ))}
        </section>
      )}
      {s.invoice && (
        <section>
          <h2>Invoice {s.invoice.number}</h2>
          <p>
            {s.invoice.clientName}
            {s.invoice.due ? ` · Due ${s.invoice.due}` : ''}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.invoice.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.description}</td>
                    <td>{l.quantity}</td>
                    <td>{money(l.unitAmount, s.currency)}</td>
                    <td>{money(l.quantity * l.unitAmount, s.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Total {money(s.invoice.total, s.currency)}</h3>
          <p className="preserve-lines">{s.invoice.notes}</p>
          <p>Approval does not record a payment.</p>
        </section>
      )}
      {data.status === 'pending' ? (
        <form
          className="plan-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setMessage('');
            const f = new FormData(e.currentTarget);
            const payload = {
              token,
              signer: String(f.get('signer')),
              decision: String(f.get('decision')),
              comment: String(f.get('comment')),
            };
            const signature = JSON.stringify(payload);
            if (pending.current?.signature !== signature)
              pending.current = { signature, id: crypto.randomUUID() };
            try {
              const r = await fetch('/api/client-approval', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...payload,
                  requestId: pending.current.id,
                }),
              });
              const result = await r.json();
              if (!r.ok) throw Error(result.message);
              setData({
                ...data,
                status: result.status,
                signer: payload.signer,
                comment: payload.comment,
                decidedAt: new Date().toISOString(),
              });
              setMessage('Your decision has been recorded.');
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Please retry.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Your decision</h2>
          <p>
            Anyone holding this private link can respond. Keep it private and
            confirm the details with your planner.
          </p>
          <label>
            Your full name
            <input name="signer" required minLength={2} maxLength={160} />
          </label>
          <label>
            Decision
            <select name="decision">
              <option value="approved">Approve this snapshot</option>
              <option value="changes_requested">Request changes</option>
            </select>
          </label>
          <label>
            Comments
            <textarea name="comment" maxLength={2000} />
          </label>
          <label className="check-label">
            <input type="checkbox" required /> I have reviewed this snapshot and
            am authorized to respond.
          </label>
          <button disabled={busy}>
            {busy ? 'Recording…' : 'Record decision'}
          </button>
          <small>
            This records a planning decision, not a verified electronic
            signature.
          </small>
        </form>
      ) : (
        <section className="panel">
          <h2>
            {data.status === 'approved'
              ? 'Approved'
              : data.status === 'changes_requested'
                ? 'Changes requested'
                : 'Unavailable'}
          </h2>
          <p>
            {data.signer}
            {data.decidedAt
              ? ` · ${new Date(data.decidedAt).toLocaleString('en-GB')}`
              : ''}
          </p>
          <p className="preserve-lines">{data.comment}</p>
        </section>
      )}
      <p role="status">{message}</p>
      <button
        className="button secondary no-print"
        onClick={() => window.print()}
      >
        Print / save PDF
      </button>
      <footer>
        <p>
          {b.email} {b.phone}
        </p>
        <small>Powered by Yingira</small>
      </footer>
    </main>
  );
}
