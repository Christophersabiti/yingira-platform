'use client';
import { useRef, useState } from 'react';
import { money } from '@/lib/commerce';
import type { PayView } from '@/lib/billing';
export function PayInvoice({
  data,
  token,
  ready,
  mode,
}: {
  data: PayView;
  token: string;
  ready: boolean;
  mode: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const id = useRef(crypto.randomUUID());
  return (
    <main
      className="client-portal"
      style={{ borderTopColor: data.brand.color }}
    >
      <strong className="eyebrow">{data.brand.name}</strong>
      <h1>Invoice</h1>
      <p>{data.number}</p>
      <h2>{data.clientName}</h2>
      <p>
        {data.eventTitle} · Due {data.due || 'on receipt'}
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.description}</td>
                <td>{l.quantity}</td>
                <td>{money(l.quantity * l.unitAmount, 'UGX')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Outstanding {money(data.total - data.paid, 'UGX')}</h2>
      <p>
        Total {money(data.total, 'UGX')} · Received {money(data.paid, 'UGX')}
      </p>
      <p className="preserve-lines">{data.notes}</p>
      {data.paid >= data.total ? (
        <p className="notice">This invoice is paid.</p>
      ) : !ready ? (
        <p className="notice">
          Online payment is not connected for this planner. Contact{' '}
          {data.brand.email || data.brand.name} for payment instructions.
        </p>
      ) : (
        <form
          className="plan-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch('/api/payments/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  token,
                  id: id.current,
                  name: f.get('name'),
                  email: f.get('email'),
                  phone: f.get('phone'),
                }),
              });
              const d = await r.json();
              if (!r.ok) throw Error(d.message);
              window.location.assign(d.redirectUrl);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Could not start payment.',
              );
              setBusy(false);
            }
          }}
        >
          <h3 className="form-wide">
            {mode === 'sandbox'
              ? 'Test payment — sandbox'
              : 'Pay securely with Pesapal'}
          </h3>
          <label>
            Your name
            <input
              name="name"
              required
              defaultValue={data.clientName}
              maxLength={160}
            />
          </label>
          <label>
            Receipt email
            <input name="email" type="email" required maxLength={254} />
          </label>
          <label>
            Phone (optional, e.g. +256700000001)
            <input name="phone" type="tel" maxLength={16} />
          </label>
          <p className="form-wide">
            You will continue to Pesapal to pay{' '}
            {money(data.total - data.paid, 'UGX')}. Your card/mobile money
            details are entered with Pesapal.
          </p>
          <button disabled={busy}>
            {busy
              ? 'Preparing…'
              : mode === 'sandbox'
                ? 'Continue to sandbox'
                : 'Continue to Pesapal'}
          </button>
          {error && (
            <p role="alert" className="form-wide">
              {error}
            </p>
          )}
        </form>
      )}
      <footer>
        {data.brand.phone} · {data.brand.email}
        <p>Powered by Yingira</p>
      </footer>
    </main>
  );
}
