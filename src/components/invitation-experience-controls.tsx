'use client';
/* eslint-disable @next/next/no-img-element */
import type { Design, InvitationExperience } from '@/lib/planning';
export function ExperienceControls({
  design,
  onChange,
  eventId,
  onTask,
  onStatus,
}: {
  design: Design;
  onChange: (design: Design) => void;
  eventId: string;
  onTask: (fn: () => Promise<void>) => Promise<void>;
  onStatus: (message: string) => void;
}) {
  const e = design.experience;
  const update = <K extends keyof InvitationExperience>(
    key: K,
    value: InvitationExperience[K],
  ) => onChange({ ...design, experience: { ...e, [key]: value } });
  return (
    <>
      <details open>
        <summary>Shared card · opening & motion</summary>
        <label>
          Shared card format
          <select
            value={e.layout}
            onChange={(v) =>
              update('layout', v.target.value as InvitationExperience['layout'])
            }
          >
            <option value="scroll">Scrolling invitation</option>
            <option value="card">Single printable card</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={e.envelope}
            onChange={(v) => update('envelope', v.target.checked)}
          />{' '}
          Begin with a sealed envelope
        </label>
        {(
          [
            ['coverTitle', 'Front page title', 160],
            ['coverSubtitle', 'Front page subtitle', 160],
            ['seal', 'Wax seal initials', 8],
            ['openingLabel', 'Open button wording', 60],
          ] as const
        ).map(([key, label, max]) => (
          <label key={key}>
            {label}
            <input
              maxLength={max}
              value={e[key]}
              onChange={(v) => update(key, v.target.value)}
            />
          </label>
        ))}
        <label>
          Envelope color
          <input
            type="color"
            value={e.envelopeColor}
            onChange={(v) => update('envelopeColor', v.target.value)}
          />
        </label>
        <label>
          Animation style
          <select
            value={e.motion}
            onChange={(v) =>
              update('motion', v.target.value as InvitationExperience['motion'])
            }
          >
            <option value="cinematic">Cinematic · lift, fade & unfold</option>
            <option value="gentle">Gentle · soft fades</option>
            <option value="none">No animation</option>
          </select>
        </label>
        <p>
          Guests who prefer reduced motion automatically receive a still
          experience.
        </p>
      </details>
      <details open>
        <summary>Flowers & foliage</summary>
        <label>
          Flower style
          <select
            value={e.flowers}
            onChange={(v) =>
              update(
                'flowers',
                v.target.value as InvitationExperience['flowers'],
              )
            }
          >
            <option value="ivory">Ivory garden · painted flowers</option>
            <option value="botanical">
              Botanical · colored petals & leaves
            </option>
            <option value="minimal">Minimal · fine botanical lines</option>
            <option value="none">No flowers</option>
          </select>
        </label>
        <label>
          Flower color
          <input
            type="color"
            value={e.flowerColor}
            onChange={(v) => update('flowerColor', v.target.value)}
          />
        </label>
        <label>
          Foliage color
          <input
            type="color"
            value={e.foliageColor}
            onChange={(v) => update('foliageColor', v.target.value)}
          />
        </label>
        <p>
          Colors customize the botanical flourishes. Ivory garden adds original
          ivory and gold painted blooms.
        </p>
      </details>
      <details open>
        <summary>Groom, bride & closing portraits</summary>
        <p>
          The groom appears first, followed by the bride. Each portrait stays
          paired with its own name.
        </p>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            onChange({
              ...design,
              groom: design.bride,
              bride: design.groom,
              experience: {
                ...e,
                groomAssetId: e.brideAssetId,
                brideAssetId: e.groomAssetId,
              },
            })
          }
        >
          Swap groom and bride names & portraits
        </button>
        <p>
          Use swap if the names and photos were entered under the opposite
          roles.
        </p>
        <p>
          The main couple photo below opens the invitation. Add separate
          portraits and a different closing photograph here.
        </p>
        {(
          [
            ['groomAssetId', 'Groom portrait'],
            ['brideAssetId', 'Bride portrait'],
            ['closingAssetId', 'Closing couple photo'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            {key !== 'closingAssetId' && (
              <span className="portrait-owner">
                {key === 'groomAssetId'
                  ? design.groom ||
                    'Enter the groom’s name under Names and message'
                  : design.bride ||
                    'Enter the bride’s name under Names and message'}
              </span>
            )}
            {e[key] && (
              <img
                className="portrait-upload-preview"
                src={`/api/planning/assets?eventId=${eventId}&assetId=${e[key]}`}
                alt={`Current ${label.toLowerCase()}`}
                width={72}
                height={88}
              />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={label}
              onChange={(v) => {
                const file = v.target.files?.[0];
                if (!file) return;
                v.target.value = '';
                void onTask(async () => {
                  if (file.size > 4_000_000)
                    throw Error('Image must be under 4 MB.');
                  const response = await fetch(
                    `/api/planning/assets?eventId=${eventId}`,
                    { method: 'POST', body: file },
                  );
                  const data = await response.json();
                  if (!response.ok)
                    throw Error(data.message || 'Upload failed');
                  update(key, data.id);
                  onStatus(
                    data.lowResolution
                      ? 'Portrait added. Resolution may be low for printing.'
                      : 'Portrait added. Saving draft…',
                  );
                });
              }}
            />
            {e[key] && (
              <button
                type="button"
                className="text-button"
                onClick={() => update(key, null)}
              >
                Remove {label.toLowerCase()}
              </button>
            )}
          </label>
        ))}
      </details>
      <details>
        <summary>Ceremony & reception</summary>
        <p>
          Leave the reception venue or time blank to use the event details.
          Times are displayed as entered, in the event’s timezone.
        </p>
        {(
          [
            ['ceremonyVenue', 'Ceremony venue', 200],
            ['ceremonyTime', 'Ceremony time', 60],
            ['ceremonyMap', 'Ceremony map link', 1000],
            ['receptionVenue', 'Reception venue', 200],
            ['receptionTime', 'Reception time', 60],
            ['receptionMap', 'Reception map link', 1000],
          ] as const
        ).map(([key, label, max]) => (
          <label key={key}>
            {label}
            <input
              type={key.endsWith('Map') ? 'url' : 'text'}
              placeholder={
                key.endsWith('Map') ? 'https://maps.google.com/…' : undefined
              }
              value={e[key]}
              maxLength={max}
              onChange={(v) => update(key, v.target.value)}
            />
          </label>
        ))}
      </details>
      <details>
        <summary>Guest notes & finishing touches</summary>
        <label>
          A kind note
          <textarea
            rows={3}
            maxLength={600}
            value={e.kindNote}
            onChange={(v) => update('kindNote', v.target.value)}
            placeholder="Optional: an adults-only celebration, accessibility or other guidance"
          />
        </label>
        <label>
          Closing message or quotation
          <textarea
            rows={3}
            maxLength={600}
            value={e.closingMessage}
            onChange={(v) => update('closingMessage', v.target.value)}
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={e.showCountdown}
            onChange={(v) => update('showCountdown', v.target.checked)}
          />{' '}
          Show countdown
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={e.showCalendar}
            onChange={(v) => update('showCalendar', v.target.checked)}
          />{' '}
          Show add to calendar
        </label>
        <p>
          RSVP availability is managed in event operations. Guest allowance and
          entrance QR always come from the guest list.
        </p>
      </details>
    </>
  );
}
