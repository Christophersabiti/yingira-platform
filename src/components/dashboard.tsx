'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, MapPin, Plus, X } from 'lucide-react';
import type { Dashboard } from '@/lib/contracts';
import { CommandForm } from './command-form';
export function DashboardView({ data }: { data: Dashboard }) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            A LITTLE PLANNING. A LOT OF POSSIBILITY.
          </span>
          <h1>
            Your events<span className="accent">.</span>
          </h1>
          <p>Bring people together. We’ll help you welcome them.</p>
        </div>
        {data.organizations.length > 0 && (
          <button className="button" onClick={() => setCreating(!creating)}>
            {creating ? <X size={17} /> : <Plus size={17} />}{' '}
            {creating ? 'Close' : 'Create event'}
          </button>
        )}
      </div>
      {data.canCreateOrganization && data.organizations.length === 0 && (
        <section className="panel welcome-panel">
          <div>
            <span className="eyebrow">YOUR FIRST STEP</span>
            <h2>Give your workspace a name.</h2>
            <p>
              Create an organizer account to start planning events. Joining a
              team? Ask your organizer to assign your confirmed email address.
            </p>
          </div>
          <CommandForm action="create_organization" label="Create workspace">
            <label>
              Organization name
              <input
                name="name"
                placeholder="e.g. Sabtech Events"
                required
                minLength={2}
                maxLength={160}
              />
            </label>
          </CommandForm>
        </section>
      )}
      {creating && (
        <section className="panel">
          <h2>A new gathering</h2>
          <CommandForm
            action="create_event"
            label="Create event"
            navigate="/events/:id"
          >
            <div className="form-grid">
              <label>
                Organization
                <select name="organizationId">
                  {data.organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Event title
                <input
                  name="title"
                  placeholder="Christopher & Diana’s wedding"
                  required
                  minLength={2}
                  maxLength={160}
                />
              </label>
              <label>
                Venue
                <input
                  name="venue"
                  placeholder="Venue name and location"
                  required
                  minLength={2}
                  maxLength={160}
                />
              </label>
              <label>
                Date and time (your device’s local time)
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label>
                Event display timezone
                <input name="timezone" defaultValue="Africa/Kampala" required />
              </label>
            </div>
          </CommandForm>
        </section>
      )}
      {!data.canCreateOrganization && data.organizations.length === 0 && (
        <section className="panel">
          <h2>Your event assignments</h2>
          <p>
            Use the email your Admin invited. Your role and gate are set by the
            Admin. One active shift per account; your colleagues can work
            alongside you.
          </p>
        </section>
      )}
      <div className="section-heading">
        <h2>
          All gatherings <span className="count">{data.events.length}</span>
        </h2>
        <span className="muted">Your administered and assigned events</span>
      </div>
      {data.events.length === 0 ? (
        <section className="empty-state">
          <CalendarDays size={36} />
          <h2>Something wonderful starts here.</h2>
          <p>
            Your events will appear here once you create one
            <br />
            or your organizer adds you to an event team.
          </p>
        </section>
      ) : (
        <div className="event-grid">
          {data.events.map((e, i) => (
            <Link
              className="event-card"
              href={e.is_admin ? `/events/${e.id}` : `/work/${e.id}`}
              key={e.id}
            >
              <div className={`event-cover cover-${i % 3}`}>
                <span className="event-monogram">{e.title.slice(0, 1)}</span>
                <span
                  className={`badge ${e.status === 'active' ? 'green' : ''}`}
                >
                  {e.status === 'active'
                    ? 'Check-in open'
                    : e.status === 'draft'
                      ? 'In preparation'
                      : 'Closed'}
                </span>
                <span className="cover-orbit" />
              </div>
              <div className="event-body">
                <span className="eyebrow">
                  {e.is_admin ? 'ADMIN' : e.role?.toUpperCase()}
                </span>
                <h3>{e.title}</h3>
                <p>
                  <CalendarDays size={15} />
                  {new Date(e.starts_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p>
                  <MapPin size={15} />
                  {e.venue}
                </p>
                <div className="event-card-footer">
                  Open event <ArrowUpRight size={18} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
