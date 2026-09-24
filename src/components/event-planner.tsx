'use client';
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  commerceCall,
  commerceSchema,
  currencies,
  money,
  moneyInput,
  parseMoney,
  type CommerceState,
  type CommerceCommand,
  type Currency,
  type InvoiceLine,
} from '@/lib/commerce';
import { csvText, downloadText } from '@/lib/planning';
import { programmeCalendar } from '@/lib/calendar';
type Save = (data: Record<string, unknown>) => Promise<void>;
const tabs = [
  'Overview',
  'Tasks',
  'Programme',
  'Suppliers',
  'Budget & deposits',
  'Client invoices',
  'Client approvals',
  'Business',
] as const;
function Field({
  label,
  name,
  value = '',
  type = 'text',
  required = false,
  max = 160,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  max?: number;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        maxLength={max}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
      />
    </label>
  );
}
function Notes({
  value = '',
  label = 'Notes',
  name = 'notes',
  max = 2000,
}: {
  value?: string;
  label?: string;
  name?: string;
  max?: number;
}) {
  return (
    <label className="form-wide">
      {label}
      <textarea name={name} defaultValue={value} maxLength={max} />
    </label>
  );
}
function PlanForm({
  title,
  children,
  save,
  build,
  button = 'Save',
  cancel,
}: {
  title: string;
  children: ReactNode;
  save: Save;
  build: (f: FormData) => Record<string, unknown>;
  button?: string;
  cancel?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  const key = useRef<{ text: string; id: string } | null>(null);
  return (
    <form
      className="plan-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
          const input = build(new FormData(e.currentTarget));
          const text = JSON.stringify(input);
          if (key.current?.text !== text)
            key.current = { text, id: crypto.randomUUID() };
          await save({ ...input, requestId: key.current.id });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to save.');
        } finally {
          lock.current = false;
          setBusy(false);
        }
      }}
    >
      <h3 className="form-wide">{title}</h3>
      {children}
      <div className="form-wide form-actions">
        <button disabled={busy}>{busy ? 'Saving…' : button}</button>
        {cancel && (
          <button type="button" className="button secondary" onClick={cancel}>
            Cancel edit
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="form-wide error-message">
          {error}
        </p>
      )}
    </form>
  );
}
function SupplierSelect({
  data,
  value,
}: {
  data: CommerceState;
  value?: string | null;
}) {
  return (
    <label>
      Supplier
      <select name="supplierId" defaultValue={value || ''}>
        <option value="">No supplier linked</option>
        {data.suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function LineEditor({
  lines,
  currency,
}: {
  lines?: InvoiceLine[];
  currency: Currency;
}) {
  const [rows, setRows] = useState(
    (lines || [{ description: '', quantity: 1, unitAmount: 0 }]).map((l) => ({
      description: l.description,
      quantity: String(l.quantity),
      price: moneyInput(l.unitAmount, currency),
    })),
  );
  return (
    <div className="form-wide invoice-lines">
      <h4>Items · {currency}</h4>
      <input type="hidden" name="lines" value={JSON.stringify(rows)} />
      {rows.map((l, i) => (
        <div className="invoice-line" key={i}>
          <label>
            Description {i + 1}
            <input
              required
              maxLength={160}
              value={l.description}
              onChange={(e) =>
                setRows(
                  rows.map((r, k) =>
                    k === i ? { ...r, description: e.target.value } : r,
                  ),
                )
              }
            />
          </label>
          <label>
            Quantity {i + 1}
            <input
              type="number"
              min={1}
              max={10000}
              step={1}
              required
              value={l.quantity}
              onChange={(e) =>
                setRows(
                  rows.map((r, k) =>
                    k === i ? { ...r, quantity: e.target.value } : r,
                  ),
                )
              }
            />
          </label>
          <label>
            Unit price {i + 1}
            <input
              inputMode="decimal"
              required
              value={l.price}
              onChange={(e) =>
                setRows(
                  rows.map((r, k) =>
                    k === i ? { ...r, price: e.target.value } : r,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="button secondary"
            disabled={rows.length === 1}
            aria-label={`Remove item ${i + 1}`}
            onClick={() => setRows(rows.filter((_, k) => k !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button secondary"
        disabled={rows.length >= 50}
        onClick={() =>
          setRows([...rows, { description: '', quantity: '1', price: '0' }])
        }
      >
        Add invoice item
      </button>
    </div>
  );
}
function lines(f: FormData, c: Currency) {
  return (
    JSON.parse(String(f.get('lines'))) as {
      description: string;
      quantity: string;
      price: string;
    }[]
  ).map((l) => ({
    description: l.description,
    quantity: Number(l.quantity),
    unitAmount: parseMoney(l.price, c),
  }));
}
const str = (f: FormData, k: string) => String(f.get(k) || '');
const optional = (f: FormData, k: string) => str(f, k) || null;
const localDate = (s: string) => {
  const d = new Date(s);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function EventPlanner({ initial }: { initial: CommerceState }) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState<(typeof tabs)[number]>('Overview'),
    [editId, setEditId] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(''),
    [packageId, setPackageId] = useState(''),
    [printInvoice, setPrintInvoice] = useState('');
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const [reviewExpiry] = useState(() =>
    localDate(new Date(Date.now() + 14 * 86400000).toISOString()),
  );
  const eid = data.event.id,
    currency = data.settings.currency;
  const settings = data.settings;
  const changeTab = (value: (typeof tabs)[number]) => {
    setTab(value);
    setEditId('');
    setQuery('');
    setNewId(crypto.randomUUID());
  };
  async function refresh() {
    setData(
      await commerceCall<CommerceState>({ action: 'state', eventId: eid }),
    );
  }
  const save: Save = async (input) => {
    const command = commerceSchema.parse({
      ...input,
      eventId: eid,
    }) as CommerceCommand;
    await commerceCall(command);
    await refresh();
    setEditId('');
    setNewId(crypto.randomUUID());
    setNotice('Saved.');
  };
  async function action(input: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      await save({ ...input, requestId: crypto.randomUUID() });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Please retry.');
    } finally {
      setBusy(false);
    }
  }
  const task = data.tasks.find((t) => t.id === editId),
    supplier = data.suppliers.find((s) => s.id === editId),
    programme = data.programme.find((p) => p.id === editId),
    cost = data.costs.find((c) => c.id === editId),
    invoice = data.invoices.find((i) => i.id === editId),
    pack = data.packages.find((p) => p.id === editId);
  const total = (key: 'planned' | 'quoted' | 'committed' | 'paid') =>
    data.costs.reduce((s, c) => s + c[key], 0);
  const filtered = (s: string) => s.toLowerCase().includes(query.toLowerCase());
  const itemEdit = (id: string) => {
    setEditId(id);
    setNotice('');
  };
  const deleteButton = (
    kind: 'task' | 'programme' | 'supplier' | 'cost',
    id: string,
    version: number,
  ) => (
    <button
      className="text-button"
      disabled={busy}
      onClick={() => {
        if (
          window.confirm(
            'Remove this planning item? Financial history and linked items cannot be removed.',
          )
        )
          void action({
            action: 'delete_item',
            kind,
            id,
            expectedVersion: version,
          });
      }}
    >
      Remove
    </button>
  );
  const rowsEnd = (
    kind: 'task' | 'programme' | 'supplier' | 'cost',
    id: string,
    version: number,
  ) => (
    <div className="row-actions">
      <button className="text-button" onClick={() => itemEdit(id)}>
        Edit
      </button>
      {deleteButton(kind, id, version)}
    </div>
  );
  const printed = data.invoices.find((i) => i.id === printInvoice);
  return (
    <>
      <div className="planner-screen">
        <Link className="back-link" href={`/events/${eid}`}>
          ← Event workspace
        </Link>
        <div className="page-heading">
          <div>
            <span className="eyebrow">PLAN THE WHOLE EVENT</span>
            <h1>{data.event.title}</h1>
            <p>Plans, people and finances in one place.</p>
          </div>
          <button
            className="button secondary"
            onClick={() =>
              void refresh().catch(() => setNotice('Could not refresh.'))
            }
          >
            Refresh
          </button>
        </div>
        <nav className="tabs plan-tabs" aria-label="Planning sections">
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t ? 'selected' : ''}
              onClick={() => changeTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <p role="status" className="planner-status">
          {notice}
        </p>
        {tab === 'Overview' && (
          <>
            <div className="metrics">
              <div className="metric">
                <span>Tasks complete</span>
                <strong>
                  {data.tasks.filter((t) => t.status === 'done').length}/
                  {data.tasks.filter((t) => t.status !== 'cancelled').length}
                </strong>
                <small>Assign an owner and due date</small>
              </div>
              <div className="metric">
                <span>Budget target</span>
                <strong>{money(settings.budget, currency)}</strong>
                <small>Committed {money(total('committed'), currency)}</small>
              </div>
              <div className="metric">
                <span>Supplier balance</span>
                <strong>
                  {money(total('committed') - total('paid'), currency)}
                </strong>
                <small>Paid {money(total('paid'), currency)}</small>
              </div>
              <div className="metric">
                <span>Client decisions</span>
                <strong>
                  {data.approvals.filter((a) => a.status === 'pending').length}
                </strong>
                <small>Pending approval links</small>
              </div>
            </div>
            <PlanForm
              key={`settings-${settings.version}`}
              title="Client & budget settings"
              save={save}
              button="Save event planning settings"
              build={(f) => ({
                action: 'settings',
                expectedVersion: settings.version,
                currency: str(f, 'currency'),
                budget: parseMoney(
                  str(f, 'budget'),
                  str(f, 'currency') as Currency,
                ),
                clientName: str(f, 'clientName'),
                clientEmail: str(f, 'clientEmail'),
              })}
            >
              <Field
                label="Client name"
                name="clientName"
                value={settings.clientName}
              />
              <Field
                label="Client email"
                name="clientEmail"
                value={settings.clientEmail}
                type="email"
                max={254}
              />
              <label>
                Event currency
                <select name="currency" defaultValue={currency}>
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <Field
                label={`Budget target (${currency})`}
                name="budget"
                value={moneyInput(settings.budget, currency)}
                required
              />
              <p className="form-wide muted">
                Choose currency before creating budget items or invoices.
                Amounts are recorded in one currency per event; currency
                conversion is not applied.
              </p>
            </PlanForm>
            <div className="panel">
              <h2>Next steps</h2>
              <div className="planning-nav">
                <button
                  className="button secondary"
                  onClick={() => changeTab('Tasks')}
                >
                  Create a checklist
                </button>
                <button
                  className="button secondary"
                  onClick={() => changeTab('Programme')}
                >
                  Build the programme
                </button>
                <button
                  className="button secondary"
                  onClick={() => changeTab('Suppliers')}
                >
                  Add suppliers
                </button>
                <button
                  className="button secondary"
                  onClick={() => changeTab('Client approvals')}
                >
                  Share a client review
                </button>
              </div>
            </div>
          </>
        )}
        {[
          'Tasks',
          'Programme',
          'Suppliers',
          'Budget & deposits',
          'Client invoices',
        ].includes(tab) && (
          <label className="planner-search">
            Search {tab.toLowerCase()}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or title"
            />
          </label>
        )}
        {tab === 'Tasks' && (
          <>
            <PlanForm
              key={`task-${task?.id || newId}-${task?.version}`}
              title={task ? 'Edit task' : 'Add a task'}
              save={save}
              button="Save task"
              cancel={task ? () => setEditId('') : undefined}
              build={(f) => ({
                action: 'task_save',
                id: task?.id || newId,
                expectedVersion: task?.version || 0,
                title: str(f, 'title'),
                owner: str(f, 'owner'),
                due: optional(f, 'due'),
                status: str(f, 'status'),
                notes: str(f, 'notes'),
              })}
            >
              <Field
                label="Task title"
                name="title"
                value={task?.title}
                required
              />
              <Field label="Task owner" name="owner" value={task?.owner} />
              <Field
                label="Task due date"
                name="due"
                value={task?.due || ''}
                type="date"
              />
              <label>
                Task status
                <select name="status" defaultValue={task?.status || 'todo'}>
                  <option value="todo">To do</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <Notes value={task?.notes} />
            </PlanForm>
            <div className="panel">
              <h2>Checklist</h2>
              {!data.tasks.length && (
                <p>
                  No tasks yet. Start with the next thing your team needs to do.
                </p>
              )}
              {data.tasks
                .filter((t) => filtered(t.title + ' ' + t.owner))
                .map((t) => (
                  <article className="plan-row" key={t.id}>
                    <div>
                      <h3>{t.title}</h3>
                      <p>
                        {t.owner || 'Unassigned'} · {t.due || 'No due date'}
                      </p>
                      <span className="badge">
                        {t.status.replaceAll('_', ' ')}
                      </span>
                      <p className="preserve-lines">{t.notes}</p>
                    </div>
                    {rowsEnd('task', t.id, t.version)}
                  </article>
                ))}
            </div>
          </>
        )}
        {tab === 'Programme' && (
          <>
            <p>
              Times are entered in this device’s timezone and displayed below in{' '}
              {data.event.timezone}.
            </p>
            <PlanForm
              key={`programme-${programme?.id || newId}-${programme?.version}`}
              title={programme ? 'Edit programme item' : 'Add programme item'}
              save={save}
              button="Save programme item"
              cancel={programme ? () => setEditId('') : undefined}
              build={(f) => ({
                action: 'programme_save',
                id: programme?.id || newId,
                expectedVersion: programme?.version || 0,
                title: str(f, 'title'),
                startsAt: new Date(str(f, 'startsAt')).toISOString(),
                endsAt: new Date(str(f, 'endsAt')).toISOString(),
                location: str(f, 'location'),
                owner: str(f, 'owner'),
                supplierId: optional(f, 'supplierId'),
                notes: str(f, 'notes'),
              })}
            >
              <Field
                label="Programme title"
                name="title"
                value={programme?.title}
                required
              />
              <Field
                label="Programme location"
                name="location"
                value={programme?.location}
              />
              <Field
                label="Starts at"
                name="startsAt"
                type="datetime-local"
                value={programme ? localDate(programme.startsAt) : ''}
                required
              />
              <Field
                label="Ends at"
                name="endsAt"
                type="datetime-local"
                value={programme ? localDate(programme.endsAt) : ''}
                required
              />
              <Field
                label="Responsible person"
                name="owner"
                value={programme?.owner}
              />
              <SupplierSelect data={data} value={programme?.supplierId} />
              <Notes value={programme?.notes} />
            </PlanForm>
            <div className="panel">
              <div className="panel-heading">
                <h2>Event programme</h2>
                <button
                  className="button secondary"
                  disabled={!data.programme.length}
                  onClick={() =>
                    downloadText(
                      programmeCalendar(eid, data.event.title, data.programme),
                      'yingira-programme.ics',
                    )
                  }
                >
                  Export calendar (.ics)
                </button>
              </div>
              <p className="muted">
                Import the calendar file into Google, Outlook or Apple Calendar.
                This is a snapshot, not a live sync.
              </p>
              {!data.programme.length && <p>No programme items yet.</p>}
              {data.programme
                .filter((p) => filtered(p.title))
                .map((p) => (
                  <article className="plan-row" key={p.id}>
                    <div>
                      <h3>{p.title}</h3>
                      <p>
                        {new Date(p.startsAt).toLocaleString('en-GB', {
                          timeZone: data.event.timezone,
                        })}{' '}
                        –{' '}
                        {new Date(p.endsAt).toLocaleTimeString('en-GB', {
                          timeZone: data.event.timezone,
                        })}
                      </p>
                      <p>
                        {p.location} · {p.owner}{' '}
                        {
                          data.suppliers.find((s) => s.id === p.supplierId)
                            ?.name
                        }
                      </p>
                      <p className="preserve-lines">{p.notes}</p>
                      {data.programme.some(
                        (other) =>
                          other.id !== p.id &&
                          other.startsAt < p.endsAt &&
                          other.endsAt > p.startsAt,
                      ) && (
                        <span className="badge">
                          Overlaps another item — check responsibilities
                        </span>
                      )}
                    </div>
                    {rowsEnd('programme', p.id, p.version)}
                  </article>
                ))}
            </div>
          </>
        )}
        {tab === 'Suppliers' && (
          <>
            <PlanForm
              key={`supplier-${supplier?.id || newId}-${supplier?.version}`}
              title={supplier ? 'Edit supplier' : 'Add supplier'}
              save={save}
              button="Save supplier"
              cancel={supplier ? () => setEditId('') : undefined}
              build={(f) => ({
                action: 'supplier_save',
                id: supplier?.id || newId,
                expectedVersion: supplier?.version || 0,
                name: str(f, 'name'),
                category: str(f, 'category'),
                contact: str(f, 'contact'),
                email: str(f, 'email'),
                phone: str(f, 'phone'),
                notes: str(f, 'notes'),
              })}
            >
              <Field
                label="Supplier name"
                name="name"
                value={supplier?.name}
                required
              />
              <Field
                label="Service category"
                name="category"
                value={supplier?.category}
                max={80}
              />
              <Field
                label="Contact person"
                name="contact"
                value={supplier?.contact}
              />
              <Field
                label="Supplier phone"
                name="phone"
                value={supplier?.phone}
                max={40}
              />
              <Field
                label="Supplier email"
                name="email"
                value={supplier?.email}
                type="email"
                max={254}
              />
              <Notes value={supplier?.notes} />
            </PlanForm>
            <div className="panel">
              <h2>Supplier directory</h2>
              {!data.suppliers.length && (
                <p>
                  Add your venue, caterer, photographer and other suppliers.
                </p>
              )}
              {data.suppliers
                .filter((s) => filtered(s.name + ' ' + s.category))
                .map((s) => (
                  <article className="plan-row" key={s.id}>
                    <div>
                      <h3>{s.name}</h3>
                      <p>
                        {s.category} · {s.contact}
                      </p>
                      <p>
                        {s.phone} · {s.email}
                      </p>
                      <p className="preserve-lines">{s.notes}</p>
                    </div>
                    {rowsEnd('supplier', s.id, s.version)}
                  </article>
                ))}
            </div>
          </>
        )}
        {tab === 'Budget & deposits' && (
          <>
            <div className="metrics">
              {(['planned', 'quoted', 'committed', 'paid'] as const).map(
                (k) => (
                  <div className="metric" key={k}>
                    <span>{k[0].toUpperCase() + k.slice(1)}</span>
                    <strong>{money(total(k), currency)}</strong>
                  </div>
                ),
              )}
            </div>
            {total('committed') > settings.budget && (
              <p className="notice">
                Committed spending is{' '}
                {money(total('committed') - settings.budget, currency)} above
                the budget target.
              </p>
            )}
            <PlanForm
              key={`cost-${cost?.id || newId}-${cost?.version}`}
              title={cost ? 'Edit budget item' : 'Add budget item'}
              save={save}
              button="Save budget item"
              cancel={cost ? () => setEditId('') : undefined}
              build={(f) => ({
                action: 'cost_save',
                id: cost?.id || newId,
                expectedVersion: cost?.version || 0,
                title: str(f, 'title'),
                supplierId: optional(f, 'supplierId'),
                planned: parseMoney(str(f, 'planned'), currency),
                quoted: parseMoney(str(f, 'quoted'), currency),
                committed: parseMoney(str(f, 'committed'), currency),
                deposit: parseMoney(str(f, 'deposit'), currency),
                due: optional(f, 'due'),
                notes: str(f, 'notes'),
              })}
            >
              <Field
                label="Budget item"
                name="title"
                value={cost?.title}
                required
              />
              <SupplierSelect data={data} value={cost?.supplierId} />
              {(['planned', 'quoted', 'committed', 'deposit'] as const).map(
                (k) => (
                  <Field
                    key={k}
                    label={`${k === 'deposit' ? 'Deposit required' : k[0].toUpperCase() + k.slice(1)} (${currency})`}
                    name={k}
                    value={moneyInput(cost?.[k] || 0, currency)}
                    required
                  />
                ),
              )}
              <Field
                label="Payment due date"
                name="due"
                type="date"
                value={cost?.due || ''}
              />
              <Notes value={cost?.notes} />
            </PlanForm>
            <div className="panel">
              <div className="panel-heading">
                <h2>Budget items</h2>
                <button
                  className="button secondary"
                  onClick={() =>
                    downloadText(
                      csvText([
                        [
                          'Item',
                          'Supplier',
                          'Currency',
                          'Planned',
                          'Quoted',
                          'Committed',
                          'Deposit required',
                          'Paid',
                          'Balance',
                          'Due',
                        ],
                        ...data.costs.map((c) => [
                          c.title,
                          data.suppliers.find((s) => s.id === c.supplierId)
                            ?.name || '',
                          currency,
                          ...[
                            c.planned,
                            c.quoted,
                            c.committed,
                            c.deposit,
                            c.paid,
                            c.committed - c.paid,
                          ].map((n) => moneyInput(n, currency)),
                          c.due || '',
                        ]),
                      ]),
                      'yingira-budget.csv',
                    )
                  }
                >
                  Export budget CSV
                </button>
              </div>
              {!data.costs.length && <p>No budget items yet.</p>}
              {data.costs
                .filter((c) => filtered(c.title))
                .map((c) => (
                  <article className="plan-row" key={c.id}>
                    <div>
                      <h3>{c.title}</h3>
                      <p>
                        {data.suppliers.find((s) => s.id === c.supplierId)
                          ?.name || 'No supplier linked'}{' '}
                        · Due {c.due || 'not set'}
                      </p>
                      <p>
                        Committed {money(c.committed, currency)} · Paid{' '}
                        {money(c.paid, currency)} · Balance{' '}
                        {money(c.committed - c.paid, currency)}
                      </p>
                      {c.paid < c.deposit && (
                        <span className="badge">
                          Deposit outstanding{' '}
                          {money(c.deposit - c.paid, currency)}
                        </span>
                      )}
                    </div>
                    {rowsEnd('cost', c.id, c.version)}
                  </article>
                ))}
            </div>
            <PaymentForm
              key={`supplier-payment-${newId}`}
              data={data}
              kind="supplier"
              save={save}
            />
            <PaymentList data={data} kind="supplier" action={action} />
          </>
        )}
        {tab === 'Client invoices' && (
          <>
            <p>
              Client receipts are separate from supplier spending. Issue an
              invoice to freeze its contents before sharing or collecting
              payment.
            </p>
            <label>
              Start from service package
              <select
                value={packageId}
                onChange={(e) => {
                  setPackageId(e.target.value);
                  setEditId('');
                }}
              >
                <option value="">Blank invoice</option>
                {data.packages
                  .filter((p) => p.active && p.currency === currency)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <PlanForm
              key={`invoice-${invoice?.id || newId}-${invoice?.version}-${packageId}`}
              title={invoice ? 'Edit invoice draft' : 'Create invoice draft'}
              save={save}
              button="Save invoice draft"
              cancel={invoice ? () => setEditId('') : undefined}
              build={(f) => ({
                action: 'invoice_save',
                id: invoice?.id || newId,
                expectedVersion: invoice?.version || 0,
                clientName: str(f, 'clientName'),
                clientEmail: str(f, 'clientEmail'),
                due: optional(f, 'due'),
                lines: lines(f, currency),
                notes: str(f, 'notes'),
              })}
            >
              <Field
                label="Invoice client name"
                name="clientName"
                value={invoice?.clientName || settings.clientName}
                required
              />
              <Field
                label="Invoice client email"
                name="clientEmail"
                value={invoice?.clientEmail || settings.clientEmail}
                type="email"
                max={254}
              />
              <Field
                label="Invoice due date"
                name="due"
                value={invoice?.due || ''}
                type="date"
              />
              <LineEditor
                currency={currency}
                lines={
                  invoice?.lines ||
                  data.packages.find((p) => p.id === packageId)?.lines
                }
              />
              <Notes
                value={invoice?.notes}
                label="Invoice notes / payment terms"
              />
            </PlanForm>
            <div className="panel">
              <h2>Client invoices</h2>
              {!data.invoices.length && <p>No invoices yet.</p>}
              {data.invoices
                .filter((i) =>
                  filtered(i.clientName + ' ' + (i.number || 'Draft')),
                )
                .map((i) => (
                  <article className="plan-row" key={i.id}>
                    <div>
                      <h3>{i.number || 'Draft invoice'}</h3>
                      <p>
                        {i.clientName} · {i.status} · Due {i.due || 'not set'}
                      </p>
                      <p>
                        Total {money(i.total, currency)} · Received{' '}
                        {money(i.paid, currency)} · Balance{' '}
                        {money(i.total - i.paid, currency)}
                      </p>
                    </div>
                    <div className="row-actions">
                      {i.status === 'draft' && (
                        <>
                          <button
                            className="text-button"
                            onClick={() => itemEdit(i.id)}
                          >
                            Edit
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Issue this invoice? Its contents will be frozen.',
                                )
                              )
                                void action({
                                  action: 'invoice_issue',
                                  id: i.id,
                                  expectedVersion: i.version,
                                });
                            }}
                          >
                            Issue invoice
                          </button>
                        </>
                      )}
                      {i.status === 'issued' && (
                        <>
                          <button
                            className="button secondary"
                            onClick={() => {
                              setPrintInvoice(i.id);
                              setTimeout(() => window.print(), 100);
                            }}
                          >
                            Print invoice
                          </button>
                          <Link
                            className="button secondary"
                            href={`/events/${eid}/billing?invoice=${i.id}`}
                          >
                            Payment link
                          </Link>
                        </>
                      )}
                      {i.status !== 'void' && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Void this invoice? It must have no remaining payments or open online checkout.',
                              )
                            )
                              void action({
                                action: 'invoice_void',
                                id: i.id,
                                expectedVersion: i.version,
                              });
                          }}
                        >
                          Void
                        </button>
                      )}
                    </div>
                  </article>
                ))}
            </div>
            <PaymentForm
              key={`client-payment-${newId}`}
              data={data}
              kind="client"
              save={save}
            />
            <PaymentList data={data} kind="client" action={action} />
          </>
        )}
        {tab === 'Client approvals' && (
          <>
            <p>
              Share only the selected snapshot. Private supplier contacts,
              payment records and other event details stay in your workspace.
            </p>
            <PlanForm
              key={`approval-${newId}`}
              title="Create private client review"
              save={save}
              button="Create approval link"
              build={(f) => ({
                action: 'approval_create',
                id: newId,
                title: str(f, 'title'),
                clientName: str(f, 'clientName'),
                kind: str(f, 'kind'),
                invoiceId: optional(f, 'invoiceId'),
                details: str(f, 'details'),
                expiresAt: new Date(str(f, 'expiresAt')).toISOString(),
              })}
            >
              <Field label="Review title" name="title" required />
              <Field
                label="Review client name"
                name="clientName"
                value={settings.clientName}
                required
              />
              <label>
                Share snapshot of
                <select name="kind">
                  <option value="budget">Current budget</option>
                  <option value="programme">Current programme</option>
                  <option value="invoice">Issued invoice</option>
                  <option value="custom">
                    Written proposal / design notes
                  </option>
                </select>
              </label>
              <label>
                Invoice (for invoice review)
                <select name="invoiceId">
                  <option value="">Choose an issued invoice</option>
                  {data.invoices
                    .filter((i) => i.status === 'issued')
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.number} · {i.clientName}
                      </option>
                    ))}
                </select>
              </label>
              <Field
                label="Review link expires"
                name="expiresAt"
                type="datetime-local"
                value={reviewExpiry}
                required
              />
              <Notes label="Client-facing details" name="details" max={6000} />
            </PlanForm>
            <div className="panel">
              <h2>Client review history</h2>
              {!data.approvals.length && <p>No reviews shared yet.</p>}
              {data.approvals.map((a) => (
                <article className="plan-row" key={a.id}>
                  <div>
                    <h3>{a.title}</h3>
                    <p>
                      {a.clientName} · {a.kind} ·{' '}
                      <strong>{a.status.replaceAll('_', ' ')}</strong>
                    </p>
                    <p>
                      Expires {new Date(a.expiresAt).toLocaleString('en-GB')}
                    </p>
                    {a.signer && (
                      <p>
                        Decision by {a.signer}: {a.comment}
                      </p>
                    )}
                  </div>
                  <div className="row-actions">
                    {a.link && a.status !== 'revoked' && (
                      <>
                        <Link
                          className="button secondary"
                          href={a.link}
                          target="_blank"
                        >
                          Open review
                        </Link>
                        <button
                          className="button secondary"
                          onClick={() =>
                            void navigator.clipboard
                              .writeText(a.link!)
                              .then(() =>
                                setNotice('Private review link copied.'),
                              )
                              .catch(() =>
                                setNotice(
                                  'Open the review and copy its address.',
                                ),
                              )
                          }
                        >
                          Copy private link
                        </button>
                      </>
                    )}
                    {a.status === 'pending' && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm('Revoke this review link?'))
                            void action({
                              action: 'approval_revoke',
                              id: a.id,
                            });
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {tab === 'Business' && (
          <>
            <div className="panel">
              <h2>Yingira subscription & integrations</h2>
              <p>
                {data.usage.events} events · {data.usage.invitations}{' '}
                invitations · {data.usage.admins} administrators in this
                organization
              </p>
              <div className="planning-nav">
                <Link className="button" href={`/events/${eid}/billing`}>
                  Subscriptions & Pesapal billing
                </Link>
                <Link
                  className="button secondary"
                  href={`/events/${eid}/whatsapp`}
                >
                  Automated WhatsApp
                </Link>
              </div>
            </div>
            <BrandForm data={data} save={save} />
            <PlanForm
              key={`package-${pack?.id || newId}-${pack?.version}`}
              title={
                pack
                  ? 'Edit service package'
                  : 'Create reusable service package'
              }
              save={save}
              button="Save service package"
              cancel={pack ? () => setEditId('') : undefined}
              build={(f) => ({
                action: 'package_save',
                id: pack?.id || newId,
                expectedVersion: pack?.version || 0,
                name: str(f, 'name'),
                description: str(f, 'description'),
                currency: pack?.currency || currency,
                lines: lines(f, pack?.currency || currency),
                active: str(f, 'active') === 'true',
              })}
            >
              <Field
                label="Package name"
                name="name"
                value={pack?.name}
                required
              />
              <label>
                Package availability
                <select
                  name="active"
                  defaultValue={pack?.active === false ? 'false' : 'true'}
                >
                  <option value="true">Available</option>
                  <option value="false">Archived</option>
                </select>
              </label>
              <Notes
                label="Package description"
                name="description"
                value={pack?.description}
              />
              <LineEditor
                currency={pack?.currency || currency}
                lines={pack?.lines}
              />
            </PlanForm>
            <div className="panel">
              <h2>Service packages</h2>
              <p>
                Reusable across this organization’s events. A copied invoice
                keeps its own prices if the package changes later.
              </p>
              {data.packages.map((p) => (
                <article className="plan-row" key={p.id}>
                  <div>
                    <h3>{p.name}</h3>
                    <p>{p.description}</p>
                    <p>
                      {money(
                        p.lines.reduce(
                          (s, l) => s + l.quantity * l.unitAmount,
                          0,
                        ),
                        p.currency,
                      )}{' '}
                      · {p.active ? 'Available' : 'Archived'}
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => itemEdit(p.id)}
                  >
                    Edit package
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
      {printed && (
        <section className="print-invoice">
          <h1 style={{ color: printed.brand?.color }}>
            {printed.brand?.name || data.brand.name}
          </h1>
          <p>{printed.brand?.tagline}</p>
          <h2>Invoice {printed.number}</h2>
          <p>
            {printed.clientName} · {printed.clientEmail}
          </p>
          <p>
            {data.event.title} · Due {printed.due || 'on receipt'}
          </p>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {printed.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.description}</td>
                  <td>{l.quantity}</td>
                  <td>{money(l.unitAmount, currency)}</td>
                  <td>{money(l.unitAmount * l.quantity, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Total {money(printed.total, currency)}</h3>
          <p>
            Received {money(printed.paid, currency)} · Outstanding{' '}
            {money(printed.total - printed.paid, currency)}
          </p>
          <p className="preserve-lines">{printed.notes}</p>
          <footer>
            {printed.brand?.email} · {printed.brand?.phone}
            <p>Generated with Yingira</p>
          </footer>
        </section>
      )}
    </>
  );
}
function PaymentForm({
  data,
  kind,
  save,
}: {
  data: CommerceState;
  kind: 'supplier' | 'client';
  save: Save;
}) {
  const id = useRef(crypto.randomUUID());
  const c = data.settings.currency;
  const choices =
    kind === 'supplier'
      ? data.costs
          .filter((x) => x.committed > x.paid)
          .map((x) => ({
            id: x.id,
            label: x.title,
            balance: x.committed - x.paid,
          }))
      : data.invoices
          .filter((x) => x.status === 'issued' && x.total > x.paid)
          .map((x) => ({
            id: x.id,
            label: x.number || x.clientName,
            balance: x.total - x.paid,
          }));
  return (
    <PlanForm
      title={
        kind === 'supplier'
          ? 'Record supplier payment'
          : 'Record manual client receipt'
      }
      button="Record payment"
      save={save}
      build={(f) => ({
        action: 'payment_record',
        id: id.current,
        targetKind: kind,
        targetId: str(f, 'targetId'),
        amount: parseMoney(str(f, 'amount'), c),
        paidOn: str(f, 'paidOn'),
        method: str(f, 'method'),
        reference: str(f, 'reference'),
        notes: str(f, 'notes'),
      })}
    >
      <p className="form-wide muted">
        Only record money already paid outside Yingira. This does not transfer
        money. Correct mistakes with a reversal; history is kept.
      </p>
      <label>
        {kind === 'supplier' ? 'Budget item to pay' : 'Invoice to credit'}
        <select name="targetId" required defaultValue="">
          <option value="">Select outstanding item</option>
          {choices.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label} · {money(x.balance, c)} remaining
            </option>
          ))}
        </select>
      </label>
      <Field label={`Payment amount (${c})`} name="amount" required />
      <Field
        label="Paid on"
        name="paidOn"
        type="date"
        value={new Date().toISOString().slice(0, 10)}
        required
      />
      <label>
        Payment method
        <select name="method">
          <option value="bank">Bank transfer</option>
          <option value="mobile_money">Mobile money</option>
          <option value="cash">Cash</option>
          <option value="other">Other</option>
        </select>
      </label>
      <Field label="Payment reference" name="reference" required />
      <Notes max={500} />
    </PlanForm>
  );
}
function PaymentList({
  data,
  kind,
  action,
}: {
  data: CommerceState;
  kind: 'supplier' | 'client';
  action: (input: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="panel">
      <h2>
        {kind === 'supplier'
          ? 'Supplier payment history'
          : 'Client receipt history'}
      </h2>
      {data.payments
        .filter((p) => p.targetKind === kind)
        .map((p) => (
          <article className="plan-row" key={p.id}>
            <div>
              <strong>
                {money(p.amount, data.settings.currency)} · {p.reference}
              </strong>
              <p>
                {p.paidOn} · {p.method} · {p.notes}
              </p>
              {p.reversalOf && <span className="badge">Reversal</span>}
            </div>
            {p.amount > 0 &&
              p.method !== 'pesapal' &&
              !data.payments.some((r) => r.reversalOf === p.id) && (
                <button
                  className="text-button"
                  onClick={() => {
                    const reason = window.prompt(
                      'Why should this payment record be reversed? (At least 5 characters)',
                    );
                    if (reason)
                      void action({
                        action: 'payment_reverse',
                        id: crypto.randomUUID(),
                        paymentId: p.id,
                        reason,
                      });
                  }}
                >
                  Reverse record
                </button>
              )}
          </article>
        ))}
    </div>
  );
}
function BrandForm({ data, save }: { data: CommerceState; save: Save }) {
  const b = data.brand;
  const [logo, setLogo] = useState(b.logoAssetId),
    [logoEvent, setLogoEvent] = useState(b.logoEventId),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <PlanForm
      key={b.version}
      title="Planner branding"
      save={save}
      button="Save planner branding"
      build={(f) => {
        if (busy) throw Error('Wait for the logo upload.');
        return {
          action: 'brand_save',
          expectedVersion: b.version,
          name: str(f, 'name'),
          tagline: str(f, 'tagline'),
          color: str(f, 'color'),
          email: str(f, 'email'),
          phone: str(f, 'phone'),
          logoAssetId: logo,
          logoEventId: logoEvent,
        };
      }}
    >
      <p className="form-wide muted">
        Used on new client review snapshots and issued invoices across your
        organization. Existing issued documents retain their original branding.
      </p>
      <Field
        label="Planner business name"
        name="name"
        value={b.name}
        required
      />
      <Field label="Brand tagline" name="tagline" value={b.tagline} />
      <Field
        label="Brand accent colour"
        name="color"
        type="color"
        value={b.color}
      />
      <Field
        label="Business email"
        name="email"
        value={b.email}
        type="email"
        max={254}
      />
      <Field label="Business phone" name="phone" value={b.phone} max={40} />
      <label>
        Upload planner logo
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setMessage('Uploading…');
            try {
              const r = await fetch(
                `/api/planning/assets?eventId=${data.event.id}`,
                { method: 'POST', body: file },
              );
              const result = await r.json();
              if (!r.ok) throw Error(result.message);
              setLogo(result.id);
              setLogoEvent(data.event.id);
              setMessage('Logo uploaded. Save branding to publish it.');
            } catch (err) {
              setMessage(err instanceof Error ? err.message : 'Upload failed.');
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {logo && (
        <div className="form-wide">
          <p>Logo attached.</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setLogo(null);
              setLogoEvent(null);
            }}
          >
            Remove logo
          </button>
        </div>
      )}
      <p className="form-wide" role="status">
        {message}
      </p>
    </PlanForm>
  );
}
