'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  csvText,
  downloadText,
  planningCall,
  guestSchema,
  type PlanningData,
  type PlanningGuest,
  type GuestInput,
} from '@/lib/planning';
import {
  fields,
  fieldLabels,
  suggestMapping,
  reviewRows,
  type GuestField,
} from '@/lib/guest-import';
const empty: GuestInput = {
  name: '',
  phone: '',
  email: '',
  capacity: 1,
  tableLabel: '',
  category: '',
  note: '',
};
export function GuestManager({
  eventId,
  title,
  initial,
}: {
  eventId: string;
  title: string;
  initial: PlanningData;
}) {
  const [data, setData] = useState(initial),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState(''),
    [editing, setEditing] = useState<PlanningGuest | null>(null),
    [form, setForm] = useState(empty),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>(
      [],
    ),
    [sheet, setSheet] = useState(0),
    [mapping, setMapping] = useState<Record<GuestField, number>>(
      suggestMapping([]),
    ),
    [country, setCountry] = useState(''),
    [fileName, setFileName] = useState('Guest list'),
    [selected, setSelected] = useState<Set<number>>(new Set()),
    [step, setStep] = useState<'map' | 'review'>('map'),
    [progress, setProgress] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const rows = useMemo(() => sheets[sheet]?.rows || [], [sheets, sheet]);
  const review = useMemo(
    () => reviewRows(rows.slice(1), mapping, country, data.guests),
    [rows, mapping, country, data.guests],
  );
  const visible = data.guests.filter(
    (g) =>
      (!category || g.category === category) &&
      [g.name, g.phone, g.email, g.tableLabel].some((v) =>
        v.toLowerCase().includes(search.toLowerCase()),
      ),
  );
  async function refresh() {
    const d = await planningCall<PlanningData>({ action: 'state', eventId });
    setData(d);
    return d;
  }
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function run(id: string) {
    setProgress('Importing… You can leave and resume this saved job.');
    let remaining = 1;
    while (remaining) {
      const r = await planningCall<{ remaining: number }>({
        action: 'run_import',
        eventId,
        jobId: id,
      });
      remaining = r.remaining;
      setProgress(`${remaining} rows remaining`);
    }
    const updated = await refresh();
    const job = updated.jobs.find((j) => j.id === id);
    setMessage(
      `Import complete: ${job?.created || 0} created, ${job?.skipped || 0} duplicates skipped. No invitations were sent.`,
    );
    setSheets([]);
    setJobId(null);
    setProgress('');
  }
  function exportGuests() {
    downloadText(
      csvText([
        [
          'Name',
          'Phone',
          'Email',
          'Total people allowed',
          'Table',
          'Category',
          'Note',
          'Admitted',
        ],
        ...visible.map((g) => [
          g.name,
          g.phone,
          g.email,
          g.capacity,
          g.tableLabel,
          g.category,
          g.note,
          g.initialCount,
        ]),
      ]),
      'yingira-guests.csv',
    );
  }
  return (
    <>
      <Link className="back-link" href={`/events/${eventId}`}>
        ← Event workspace
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">GUESTS · {title}</span>
          <h1>A place for everyone.</h1>
          <p>One row is one invitation, which may welcome several people.</p>
        </div>
        <button className="button secondary" onClick={exportGuests}>
          Export filtered guests
        </button>
      </div>
      <div aria-live="polite">
        {message && <p className="notice">{message}</p>}
        {progress && <p className="notice">{progress}</p>}
      </div>
      <section className="panel">
        <h2>Import your guest list</h2>
        <p>
          CSV or Excel (.xlsx), up to 4 MB and 5,000 invitations. Your list is
          reviewed before anything is created.
        </p>
        <div className="support-actions">
          <button
            className="button secondary"
            onClick={() =>
              downloadText(
                csvText([
                  [
                    'Name',
                    'Phone',
                    'Email',
                    'Total people allowed',
                    'Table',
                    'Category',
                    'Note',
                  ],
                  ['Example Household', '', '', 2, 'Table 1', 'Family', ''],
                ]),
                'yingira-template.csv',
              )
            }
          >
            Download template
          </button>
          <label className="button secondary">
            Choose file
            <input
              aria-label="Guest spreadsheet"
              type="file"
              accept=".csv,.xlsx"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void work(async () => {
                  if (f.size > 4_000_000)
                    throw Error('File must be under 4 MB.');
                  const kind = f.name.split('.').pop()?.toLowerCase();
                  const r = await fetch(
                    `/api/planning/parse?eventId=${eventId}&kind=${kind}`,
                    { method: 'POST', body: f },
                  );
                  const result = await r.json();
                  if (!r.ok) throw Error(result.message);
                  setSheets(result.sheets);
                  setSheet(0);
                  setMapping(suggestMapping(result.sheets[0]?.rows[0] || []));
                  setFileName(f.name.slice(0, 100));
                  setStep('map');
                  setJobId(null);
                });
              }}
            />
          </label>
        </div>
        {sheets.length > 0 && (
          <div className="import-panel">
            <label>
              Worksheet
              <select
                disabled={busy}
                value={sheet}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setSheet(i);
                  setMapping(suggestMapping(sheets[i].rows[0] || []));
                  setStep('map');
                  setJobId(null);
                }}
              >
                {sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {step === 'map' ? (
              <>
                <h3>Match your columns</h3>
                <div className="form-grid">
                  {fields.map((f) => (
                    <label key={f}>
                      {fieldLabels[f]}
                      {['name', 'capacity'].includes(f) ? ' *' : ''}
                      <select
                        value={mapping[f]}
                        onChange={(e) =>
                          setMapping({
                            ...mapping,
                            [f]: Number(e.target.value),
                          })
                        }
                      >
                        <option value={-1}>Not provided</option>
                        {(rows[0] || []).map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Column ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <label>
                    Local phone numbers
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    >
                      <option value="">
                        Require international format (or blank)
                      </option>
                      <option value="UG">
                        Convert Ugandan 07… numbers to +256…
                      </option>
                    </select>
                  </label>
                </div>
                <button
                  className="button"
                  disabled={mapping.name < 0 || mapping.capacity < 0}
                  onClick={() => {
                    setSelected(
                      new Set(
                        review
                          .filter((r) => !r.error && !r.duplicate)
                          .map((r) => r.rowKey),
                      ),
                    );
                    setStep('review');
                  }}
                >
                  Review guests
                </button>
              </>
            ) : (
              <>
                <h3>Review before importing</h3>
                <p>
                  {selected.size} invitations · up to{' '}
                  {review
                    .filter((r) => selected.has(r.rowKey))
                    .reduce((n, r) => n + r.guest.capacity, 0)}{' '}
                  people · {review.filter((r) => r.error).length} invalid rows
                </p>
                <p>
                  Possible duplicates are unselected. Select one explicitly to
                  keep it as a separate invitation.
                </p>
                <div className="support-actions">
                  <button
                    className="button secondary"
                    disabled={busy || !!jobId}
                    onClick={() => setStep('map')}
                  >
                    Back to columns
                  </button>
                  <button
                    className="button secondary"
                    onClick={() =>
                      downloadText(
                        csvText([
                          ['Source row', 'Problem', ...(rows[0] || [])],
                          ...review
                            .filter((r) => r.error || r.duplicate)
                            .map((r) => [
                              r.rowKey,
                              r.error || 'Possible duplicate',
                              ...r.original,
                            ]),
                        ]),
                        'yingira-import-review.csv',
                      )
                    }
                  >
                    Download review report
                  </button>
                </div>
                <div className="table-scroll import-preview">
                  <table>
                    <thead>
                      <tr>
                        <th>Include</th>
                        <th>Row</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>People</th>
                        <th>Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {review.map((r) => (
                        <tr key={r.rowKey}>
                          <td>
                            <input
                              aria-label={`Include row ${r.rowKey}`}
                              type="checkbox"
                              disabled={!!r.error || busy || !!jobId}
                              checked={selected.has(r.rowKey)}
                              onChange={(e) =>
                                setSelected((s) => {
                                  const n = new Set(s);
                                  if (e.target.checked) n.add(r.rowKey);
                                  else n.delete(r.rowKey);
                                  return n;
                                })
                              }
                            />
                          </td>
                          <td>{r.rowKey}</td>
                          <td>{r.guest.name}</td>
                          <td>{r.guest.phone || '—'}</td>
                          <td>{r.guest.capacity || '—'}</td>
                          <td>
                            {r.error ||
                              (r.duplicate ? 'Possible duplicate' : 'Ready')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="button"
                  disabled={busy || !selected.size}
                  onClick={() =>
                    void work(async () => {
                      const id = jobId || crypto.randomUUID();
                      setJobId(id);
                      await planningCall({
                        action: 'create_import',
                        eventId,
                        jobId: id,
                        name: fileName,
                        rows: review
                          .filter((r) => selected.has(r.rowKey) && !r.error)
                          .map((r) => ({
                            ...r.guest,
                            rowKey: r.rowKey,
                            keepDuplicate: r.duplicate,
                          })),
                      });
                      await run(id);
                    })
                  }
                >
                  {busy
                    ? 'Importing…'
                    : jobId
                      ? 'Resume confirmed import'
                      : `Confirm import of ${selected.size} invitations`}
                </button>
              </>
            )}
          </div>
        )}
      </section>
      {data.jobs.length > 0 && (
        <details className="panel">
          <summary>Import history and recovery</summary>
          {data.jobs.map((j) => (
            <div className="job-row" key={j.id}>
              <span>
                <strong>{j.name}</strong> · {j.processed}/{j.total} processed ·{' '}
                {j.created} created · {j.skipped} skipped
              </span>
              {j.processed < j.total && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void work(() => run(j.id))}
                >
                  Resume import
                </button>
              )}
            </div>
          ))}
        </details>
      )}
      <section className="panel">
        <div className="form-grid">
          <label>
            Search guests
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone, email or table"
            />
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {Array.from(
                new Set(data.guests.map((g) => g.category).filter(Boolean)),
              ).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <p>
          {visible.length} invitations ·{' '}
          {visible.reduce((n, g) => n + g.capacity, 0)} people allowed
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Contact</th>
                <th>People</th>
                <th>Table</th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>{g.phone || g.email || 'Not collected'}</td>
                  <td>
                    {g.initialCount}/{g.capacity} admitted
                  </td>
                  <td>{g.tableLabel || 'Unassigned'}</td>
                  <td>{g.category || '—'}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setEditing(g);
                        setForm({ ...g });
                      }}
                    >
                      Edit
                    </button>{' '}
                    <Link href={`/events/${eventId}/studio?guest=${g.id}`}>
                      Card & downloads
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <section className="panel" aria-label="Edit guest">
          <h2>Edit {editing.name}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void work(async () => {
                const guest = guestSchema.parse(form);
                await planningCall({
                  action: 'save_guest',
                  eventId,
                  guestId: editing.id,
                  expectedVersion: editing.version,
                  guest,
                });
                await refresh();
                setEditing(null);
                setMessage(
                  'Guest updated. Existing QR and admissions are preserved.',
                );
              });
            }}
          >
            <div className="form-grid">
              {fields.map((f) => (
                <label key={f}>
                  {fieldLabels[f]}
                  <input
                    type={f === 'capacity' ? 'number' : 'text'}
                    min={
                      f === 'capacity' ? editing.initialCount || 1 : undefined
                    }
                    max={f === 'capacity' ? 100 : undefined}
                    value={form[f]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [f]:
                          f === 'capacity'
                            ? Number(e.target.value)
                            : e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="support-actions">
              <button className="button" disabled={busy}>
                Save guest
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
