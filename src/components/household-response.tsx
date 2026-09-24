'use client';
import { useState } from 'react';
import type { HouseholdMember } from '@/lib/operations';
export function HouseholdResponse({
  capacity,
  initial,
  revision: initialRevision,
  onSave,
  deadline,
  disabled = false,
}: {
  capacity: number;
  initial: HouseholdMember[];
  revision: number;
  onSave: (
    members: HouseholdMember[],
    revision: number,
  ) => Promise<{ revision: number }>;
  deadline?: string | null;
  disabled?: boolean;
}) {
  const [members, setMembers] = useState<HouseholdMember[]>(
    initial.length
      ? initial
      : [{ name: '', response: 'yes', meal: '', dietary: '' }],
  );
  const [revision, setRevision] = useState(initialRevision),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  function change(index: number, key: keyof HouseholdMember, value: string) {
    setMembers((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage('');
        try {
          const saved = await onSave(members, revision);
          setRevision(saved.revision);
          setMessage('Your response is saved. Thank you.');
        } catch (e) {
          setMessage(e instanceof Error ? e.message : 'Please try again');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Your household response</h2>
      <p>
        Up to {capacity} people. Add each household member and tell us who will
        attend. This response does not check anyone in.
      </p>
      {deadline && (
        <p>
          Respond by {new Date(deadline).toLocaleString()} (your device’s
          timezone).
        </p>
      )}
      <fieldset disabled={disabled || busy}>
        {members.map((m, i) => (
          <div className="household-member" key={i}>
            <label>
              Name {i + 1}
              <input
                required
                maxLength={160}
                value={m.name}
                onChange={(e) => change(i, 'name', e.target.value)}
              />
            </label>
            <label>
              Attending {i + 1}
              <select
                value={m.response}
                onChange={(e) => change(i, 'response', e.target.value)}
              >
                <option value="yes">Yes, attending</option>
                <option value="no">Unable to attend</option>
              </select>
            </label>
            <label>
              Meal preference {i + 1}
              <input
                maxLength={80}
                value={m.meal}
                onChange={(e) => change(i, 'meal', e.target.value)}
              />
            </label>
            <label>
              Dietary requirements {i + 1}
              <input
                maxLength={300}
                value={m.dietary}
                onChange={(e) => change(i, 'dietary', e.target.value)}
              />
            </label>
            {members.length > 1 && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setMembers((rows) => rows.filter((_, n) => n !== i))
                }
              >
                Remove member {i + 1}
              </button>
            )}
          </div>
        ))}
        <div className="support-actions">
          <button
            type="button"
            className="button secondary"
            disabled={members.length >= capacity}
            onClick={() =>
              setMembers((rows) => [
                ...rows,
                { name: '', response: 'yes', meal: '', dietary: '' },
              ])
            }
          >
            Add household member
          </button>
          <button className="button">
            {busy ? 'Saving…' : 'Save response'}
          </button>
        </div>
      </fieldset>
      {disabled && (
        <p>Responses are closed. Contact your host to make a change.</p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
export function GuestRsvp({
  token,
  capacity,
  members,
  revision,
  deadline,
}: {
  token: string;
  capacity: number;
  members: HouseholdMember[];
  revision: number;
  deadline: string | null;
}) {
  const [closed] = useState(
    () => !!deadline && new Date(deadline).getTime() < Date.now(),
  );
  return (
    <section className="panel guest-rsvp">
      <HouseholdResponse
        capacity={capacity}
        initial={members}
        revision={revision}
        deadline={deadline}
        disabled={closed}
        onSave={async (members, expectedRevision) => {
          const r = await fetch('/api/rsvp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, members, expectedRevision }),
          });
          const data = await r.json();
          if (!r.ok) throw Error(data.message);
          return data;
        }}
      />
    </section>
  );
}
