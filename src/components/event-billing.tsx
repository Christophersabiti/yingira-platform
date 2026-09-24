'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  billingCall,
  type BillingCommand,
  type BillingState,
  type SubscriptionPlan,
} from '@/lib/billing';
import { money, parseMoney, type CommerceState } from '@/lib/commerce';
export function EventBilling({
  initial,
  event,
  selectedInvoice,
}: {
  initial: BillingState;
  event: CommerceState;
  selectedInvoice: string;
}) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [editing, setEditing] = useState<SubscriptionPlan | null>(null),
    [invoiceId, setInvoiceId] = useState(selectedInvoice);
  const lock = useRef(false);
  const [planId, setPlanId] = useState(() => crypto.randomUUID());
  const eventId = event.event.id;
  async function run(command: BillingCommand) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      const result = await billingCall<{
        redirectUrl?: string;
        id?: string;
        status?: string;
      }>(command);
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      setData(await billingCall<BillingState>({ action: 'state', eventId }));
      setMessage(result.status ? `Payment status: ${result.status}` : 'Saved.');
      return result;
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Could not complete this request.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function subscribe(p: SubscriptionPlan) {
    if (
      !window.confirm(
        `Continue to Pesapal for ${money(p.price, 'UGX')} for ${p.days} days? This is a prepaid term with manual renewal.`,
      )
    )
      return;
    const r = await run({
      action: 'subscription_order',
      eventId,
      id: crypto.randomUUID(),
      planId: p.id,
      planVersion: p.version,
      customerName: event.brand.name,
    });
    if (r?.id) await run({ action: 'process_order', eventId, id: r.id });
  }
  return (
    <>
      <Link className="back-link" href={`/events/${eventId}/plan`}>
        ← Planning workspace
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">COMMERCIAL WORKSPACE</span>
          <h1>Subscriptions & payments</h1>
          <p>
            UGX billing through Pesapal. Client payments use your organization’s
            merchant account.
          </p>
        </div>
      </div>
      <p role="status">{message}</p>
      <section className="panel">
        <h2>Your Yingira subscription</h2>
        {data.subscription ? (
          <>
            <h3>{data.subscription.plan_name}</h3>
            {data.subscription.starts_at && (
              <p>
                Latest paid term starts{' '}
                {new Date(data.subscription.starts_at).toLocaleDateString(
                  'en-GB',
                )}
                . A future term activates on its start date.
              </p>
            )}
            <p>
              Term ends{' '}
              {new Date(data.subscription.expires_at).toLocaleDateString(
                'en-GB',
              )}{' '}
              · {data.subscription.event_limit} active events ·{' '}
              {data.subscription.guest_limit} invitations per event
            </p>
          </>
        ) : (
          <p>Pilot access — no paid subscription has been started.</p>
        )}
        <p>
          {event.usage.events} total events · {event.usage.invitations} total
          invitations. Closed events remain available in your records.
        </p>
        <p>
          Subscriptions are prepaid for the selected term. No automatic renewal
          or saved-card charging is enabled. Expired subscriptions restrict new
          events/invitations; existing gate check-in remains available.
        </p>
        {!data.platformReady && (
          <p className="notice">
            Pesapal subscription checkout is not connected yet. Plans can be
            prepared before activation.
          </p>
        )}
        {data.platformMode === 'sandbox' && (
          <p className="notice">
            Sandbox mode: test payments only. Tests do not activate a paid
            subscription.
          </p>
        )}
        <div className="package-grid">
          {data.plans
            .filter((p) => p.active)
            .map((p) => (
              <article className="package-card" key={p.id}>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <strong>
                  {money(p.price, 'UGX')} / {p.days} days
                </strong>
                <p>
                  {p.event_limit} active events · {p.guest_limit} invitations
                  per event
                </p>
                <button
                  disabled={busy || !data.platformReady}
                  onClick={() => void subscribe(p)}
                >
                  Choose / renew plan
                </button>
              </article>
            ))}
        </div>
        {!data.plans.some((p) => p.active) && (
          <p>No subscription plans are published yet.</p>
        )}
      </section>
      <section className="panel">
        <h2>Client invoice payment links</h2>
        <p>
          {data.merchantReady
            ? `Pesapal merchant connected (${data.merchantMode}).`
            : 'Your organization’s Pesapal merchant is not connected. Invoice links can still show balances and contact instructions.'}
        </p>
        <label>
          Issued invoice
          <select
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          >
            <option value="">Choose invoice</option>
            {event.invoices
              .filter((i) => i.status === 'issued')
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.number} · {i.clientName}
                </option>
              ))}
          </select>
        </label>
        <button
          disabled={busy || !invoiceId}
          onClick={() =>
            void run({
              action: 'invoice_link',
              eventId,
              id: crypto.randomUUID(),
              invoiceId,
            })
          }
        >
          Create / show payment link
        </button>
        {data.invoiceLinks.map((l) => (
          <article className="plan-row" key={l.id}>
            <div>
              <strong>
                {event.invoices.find((i) => i.id === l.invoiceId)?.number ||
                  'Invoice'}
              </strong>
              <p>
                {l.revoked
                  ? 'Revoked'
                  : `Expires ${new Date(l.expiresAt).toLocaleDateString('en-GB')}`}
              </p>
            </div>
            {!l.revoked && (
              <div className="row-actions">
                {l.link && (
                  <>
                    <Link
                      className="button secondary"
                      href={l.link}
                      target="_blank"
                    >
                      Open invoice
                    </Link>
                    <button
                      className="button secondary"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(l.link!)
                          .then(() =>
                            setMessage('Private payment link copied.'),
                          )
                          .catch(() =>
                            setMessage(
                              'Open the invoice and copy its address.',
                            ),
                          )
                      }
                    >
                      Copy payment link
                    </button>
                  </>
                )}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Revoke this link? A payment already started at Pesapal can still complete.',
                      )
                    )
                      void run({ action: 'revoke_link', eventId, id: l.id });
                  }}
                >
                  Revoke link
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Payment orders</h2>
        <p>
          Only verified completed payments credit invoices or activate
          subscriptions. Failed or reversed payments do not grant access.
        </p>
        {!data.orders.length && <p>No online payment orders yet.</p>}
        {data.orders.map((o) => (
          <article className="plan-row" key={o.id}>
            <div>
              <strong>
                {o.purpose === 'subscription'
                  ? 'Yingira subscription'
                  : 'Client invoice'}{' '}
                · {money(o.amount, 'UGX')}
              </strong>
              <p>
                {o.status}{' '}
                {o.provider_mode === 'sandbox'
                  ? '(sandbox — no balance credited)'
                  : ''}{' '}
                · {new Date(o.created_at).toLocaleString('en-GB')}
              </p>
              <small>Reference {o.id}</small>
              {o.last_error && <p>{o.last_error}</p>}
            </div>
            <div className="row-actions">
              {!o.tracking_id &&
                ['unknown', 'submitting'].includes(o.status) && (
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      const trackingId = window.prompt(
                        'Enter the order tracking UUID from your Pesapal merchant records. Yingira will verify its reference and amount before changing anything.',
                      );
                      if (trackingId)
                        void run({
                          action: 'verify_order',
                          eventId,
                          id: o.id,
                          trackingId,
                        });
                    }}
                  >
                    Reconcile with Pesapal tracking ID
                  </button>
                )}
              {o.tracking_id && (
                <button
                  disabled={busy}
                  className="button secondary"
                  onClick={() =>
                    void run({ action: 'verify_order', eventId, id: o.id })
                  }
                >
                  Refresh payment status
                </button>
              )}
              {['created', 'pending'].includes(o.status) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run({ action: 'process_order', eventId, id: o.id })
                  }
                >
                  Continue checkout
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
      {data.isPlatformAdmin && (
        <section className="panel">
          <h2>Platform owner: subscription plans</h2>
          <p>
            Only the Yingira platform owner can publish prices. Prices and
            allowances are copied into each order so later edits do not change
            an existing purchase.
          </p>
          <form
            className="plan-form"
            key={editing?.id || planId}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                const r = await run({
                  action: 'plan_save',
                  eventId,
                  id: editing?.id || planId,
                  expectedVersion: editing?.version || 0,
                  name: String(f.get('name')),
                  description: String(f.get('description')),
                  price: parseMoney(String(f.get('price')), 'UGX'),
                  days: Number(f.get('days')) as 30 | 90 | 365,
                  eventLimit: Number(f.get('eventLimit')),
                  guestLimit: Number(f.get('guestLimit')),
                  active: f.get('active') === 'on',
                });
                if (r) {
                  setEditing(null);
                  setPlanId(crypto.randomUUID());
                }
              } catch (err) {
                setMessage(
                  err instanceof Error ? err.message : 'Check the plan fields.',
                );
              }
            }}
          >
            <label>
              Plan name
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={editing?.name}
              />
            </label>
            <label>
              Plan price (UGX)
              <input
                name="price"
                inputMode="numeric"
                required
                defaultValue={editing?.price}
              />
            </label>
            <label>
              Term length
              <select name="days" defaultValue={editing?.days || 30}>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>365 days</option>
              </select>
            </label>
            <label>
              Active event limit
              <input
                name="eventLimit"
                type="number"
                min={1}
                max={10000}
                required
                defaultValue={editing?.event_limit || 5}
              />
            </label>
            <label>
              Invitations per event
              <input
                name="guestLimit"
                type="number"
                min={1}
                max={1000000}
                required
                defaultValue={editing?.guest_limit || 500}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing?.active}
              />{' '}
              Publish for purchase
            </label>
            <label className="form-wide">
              Plan description
              <textarea
                name="description"
                maxLength={1500}
                defaultValue={editing?.description}
              />
            </label>
            <button disabled={busy}>Save subscription plan</button>
            {editing && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(null)}
              >
                Cancel edit
              </button>
            )}
          </form>
          {data.plans.map((p) => (
            <article className="plan-row" key={p.id}>
              <div>
                <strong>
                  {p.name} · {money(p.price, 'UGX')}
                </strong>
                <p>
                  {p.active ? 'Published' : 'Draft / archived'} · {p.days} days
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => setEditing(p)}
              >
                Edit plan
              </button>
            </article>
          ))}
        </section>
      )}
      <section className="panel">
        <h2>Integration setup</h2>
        <p>
          Configure separate Pesapal credentials for Yingira subscriptions and
          each planner’s client receipts. Until connected, checkout remains
          disabled.
        </p>
        <p>
          Organization ID: <code>{data.organizationId}</code>
        </p>
        <p>
          Calendar: export the programme as ICS from the planning workspace.
          Spreadsheets: export the budget and seating lists as CSV. These
          exports do not continuously sync external accounts.
        </p>
      </section>
    </>
  );
}
