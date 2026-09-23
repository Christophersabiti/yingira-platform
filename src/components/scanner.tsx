'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  Check,
  ScanLine,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import type QrScanner from 'qr-scanner';
import {
  commandSchema,
  parseQr,
  type Receipt,
  type Scan,
  type Command,
} from '@/lib/contracts';
import { command } from './command-form';
export function Scanner({
  event,
  origin,
  userId,
  leaseId,
}: {
  userId: string;
  leaseId: string;
  event: { id: string; title: string; gates: { id: string; name: string }[] };
  origin: string;
}) {
  const [recovery] = useState(() => {
    try {
      const raw = sessionStorage.getItem(
        `yingira-pending:${userId}:${event.id}`,
      );
      if (!raw) return { intent: null, blocked: false };
      const parsed = commandSchema.safeParse(JSON.parse(raw));
      if (
        parsed.success &&
        parsed.data.action === 'admit' &&
        parsed.data.eventId === event.id
      ) {
        return { intent: parsed.data, blocked: false };
      }
      return { intent: null, blocked: true };
    } catch {
      return { intent: null, blocked: true };
    }
  });
  const restored = recovery.intent;
  const video = useRef<HTMLVideoElement>(null),
    camera = useRef<QrScanner | null>(null),
    busyRef = useRef(false),
    pendingRef = useRef<Extract<Command, { action: 'admit' }> | null>(restored);
  const [gate, setGate] = useState(
      restored?.gateId ?? event.gates[0]?.id ?? '',
    ),
    [cameraOn, setCameraOn] = useState(false),
    [cameraError, setCameraError] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(
      restored
        ? 'An admission result is pending. Recover it before scanning another guest.'
        : '',
    ),
    [scan, setScan] = useState<Scan | null>(
      restored
        ? {
            guestName: 'Pending admission',
            phoneSuffix: '',
            capacity: 0,
            initialCount: 0,
            insideCount: 0,
            remaining: 0,
            version: restored.expectedVersion,
            tableLabel: '',
          }
        : null,
    ),
    [token, setToken] = useState(restored?.token ?? ''),
    [quantity, setQuantity] = useState(1),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [unknown, setUnknown] = useState(!!restored),
    [offline, setOffline] = useState(false);
  async function validate(raw: string) {
    if (busyRef.current || pendingRef.current) return;
    const parsed = parseQr(raw, origin);
    if (!parsed) {
      setError('This is not a Yingira invitation for this site.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    setCameraOn(false);
    camera.current?.stop();
    try {
      const result = await command<Scan>({
        action: 'validate',
        leaseId,
        eventId: event.id,
        gateId: gate,
        token: parsed,
      });
      if (!result.ok) {
        setError(result.message);
        setScan(null);
      } else {
        setScan(result.data);
        setToken(parsed);
        setQuantity(1);
        setReceipt(null);
      }
    } catch {
      setError(
        'Could not verify this invitation. Check your connection and scan again.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    function online() {
      setOffline(!navigator.onLine);
    }
    online();
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', online);
      camera.current?.destroy();
    };
  }, []);
  async function startCamera() {
    setCameraError('');
    if (!video.current) return;
    try {
      camera.current?.destroy();
      const { default: QR } = await import('qr-scanner');
      camera.current = new QR(
        video.current,
        (r) => {
          void validate(r.data);
        },
        {
          preferredCamera: 'environment',
          highlightScanRegion: true,
          returnDetailedScanResult: true,
        },
      );
      await camera.current.start();
      setCameraOn(true);
    } catch {
      setCameraError(
        'Camera unavailable. Allow camera access in browser settings, or paste the invitation link below. Camera scanning needs HTTPS or localhost.',
      );
    }
  }
  async function admit() {
    if (busyRef.current || !scan) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      let intent = pendingRef.current;
      if (!intent) {
        let deviceId = localStorage.getItem('yingira-device');
        if (!deviceId) {
          deviceId = crypto.randomUUID();
          localStorage.setItem('yingira-device', deviceId);
        }
        intent = {
          action: 'admit',
          eventId: event.id,
          gateId: gate,
          token,
          quantity,
          expectedVersion: scan.version,
          idempotencyKey: crypto.randomUUID(),
          deviceId,
        };
        pendingRef.current = intent;
        sessionStorage.setItem(
          `yingira-pending:${userId}:${event.id}`,
          JSON.stringify(intent),
        );
      }
      intent = { ...intent, leaseId };
      const result = await command<Receipt>(intent);
      if (result.ok) {
        setReceipt(result.data);
        setScan(null);
        setUnknown(false);
      } else {
        setError(result.message);
        setScan(null);
        setUnknown(false);
      }
      pendingRef.current = null;
      sessionStorage.removeItem(`yingira-pending:${userId}:${event.id}`);
    } catch {
      setUnknown(true);
      setError(
        'The result is not confirmed. Do not admit again. Recover the result using the same request below.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  if (recovery.blocked)
    return (
      <main className="standalone">
        <h1>Check the last admission.</h1>
        <p>
          A saved admission request could not be read, or this browser cannot
          preserve request recovery. Ask the organizer to check the guest’s
          attendance before using another device.
        </p>
        <Link className="button" href={`/events/${event.id}`}>
          Back to event
        </Link>
      </main>
    );
  return (
    <main className="scanner-page">
      <header>
        <Link href={`/events/${event.id}`} className="back-link">
          <ArrowLeft size={18} /> Event
        </Link>
        <Link href="/dashboard" className="brand">
          yingira.
        </Link>
        <span className="badge">Entrance</span>
      </header>
      <div className="scanner-content">
        <span className="eyebrow">WELCOME TEAM</span>
        <h1>{event.title}</h1>
        <label className="gate-select">
          Your gate
          <select
            value={gate}
            disabled={busy || !!scan || unknown}
            onChange={(e) => {
              camera.current?.stop();
              setCameraOn(false);
              setGate(e.target.value);
            }}
          >
            {event.gates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        {offline && (
          <div className="notice error">
            <WifiOff size={18} /> You are offline. Admission requires a
            connection in this milestone.
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {receipt ? (
          <section className="scan-success" aria-live="polite">
            <span className="success-icon large">
              <Check size={32} />
            </span>
            <span className="eyebrow">ADMITTED SUCCESSFULLY</span>
            <h2>{receipt.guestName}</h2>
            <strong className="admitted-quantity">
              {receipt.quantity} {receipt.quantity === 1 ? 'person' : 'people'}
            </strong>
            <div className="table-direction">
              <span>TABLE / DIRECTIONS</span>
              <strong>{receipt.tableLabel || 'Ask the welcome team'}</strong>
            </div>
            <p>
              {receipt.initialCount} admitted · {receipt.remaining} remaining
            </p>
            <time>{new Date(receipt.acceptedAt).toLocaleTimeString()}</time>
            <button
              className="button"
              onClick={() => {
                setReceipt(null);
                setError('');
              }}
            >
              Scan next guest <ScanLine size={18} />
            </button>
          </section>
        ) : scan ? (
          <section className="scan-verification">
            <span className="valid-label">
              <ShieldCheck size={18} />
              {unknown ? 'RESULT PENDING' : 'VALID INVITATION'}
            </span>
            <h2>{scan.guestName}</h2>
            {!unknown && (
              <>
                <p className="phone-mask">
                  {scan.phoneSuffix ? (
                    <>
                      Phone ending in <strong>{scan.phoneSuffix}</strong>
                    </>
                  ) : (
                    'No phone number provided'
                  )}
                </p>
                <p className="muted">
                  {scan.phoneSuffix
                    ? 'Confirm the guest’s name and phone digits.'
                    : 'Confirm the guest’s name against their invitation. Ask the supervisor if uncertain.'}
                </p>
                <div className="scan-counts">
                  <div>
                    <span>Allowed</span>
                    <strong>{scan.capacity}</strong>
                  </div>
                  <div>
                    <span>Admitted</span>
                    <strong>{scan.initialCount}</strong>
                  </div>
                  <div>
                    <span>Remaining</span>
                    <strong>{scan.remaining}</strong>
                  </div>
                </div>
                {scan.remaining > 0 ? (
                  <label>
                    People arriving now
                    <input
                      type="number"
                      min={1}
                      max={scan.remaining}
                      value={quantity}
                      disabled={busy}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </label>
                ) : (
                  <div className="notice error">
                    CAPACITY REACHED — refer to the organizer. Exit and re-entry
                    are not yet enabled.
                  </div>
                )}
              </>
            )}
            {(unknown || scan.remaining > 0) && (
              <button
                className="button"
                disabled={
                  busy ||
                  offline ||
                  (!unknown &&
                    (!Number.isInteger(quantity) ||
                      quantity < 1 ||
                      quantity > scan.remaining))
                }
                onClick={admit}
              >
                {busy
                  ? 'Confirming…'
                  : unknown
                    ? 'Recover admission result'
                    : `Admit ${quantity} ${quantity === 1 ? 'person' : 'people'}`}
                <Check size={18} />
              </button>
            )}
            {!unknown && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setScan(null);
                  setError('');
                }}
              >
                Cancel and scan another invitation
              </button>
            )}
          </section>
        ) : (
          <>
            <div className={`camera-view ${cameraOn ? 'running' : ''}`}>
              <video ref={video} muted playsInline />
              <div className="camera-overlay">
                <div className="scan-frame" />
                {!cameraOn && (
                  <>
                    <ScanLine size={44} />
                    <h2>A good welcome starts here.</h2>
                    <p>Scan the guest’s invitation QR.</p>
                  </>
                )}
              </div>
            </div>
            {cameraError && (
              <div className="notice error" role="alert">
                {cameraError}
              </div>
            )}
            <button
              className="button camera-button"
              disabled={busy || offline || !gate}
              onClick={startCamera}
            >
              <Camera size={19} />
              {cameraOn ? 'Restart camera' : 'Open camera'}
            </button>
            <details className="manual-link">
              <summary>Use an invitation link instead</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void validate(
                    String(new FormData(e.currentTarget).get('link')),
                  );
                }}
              >
                <label>
                  Invitation link
                  <input
                    type="url"
                    name="link"
                    placeholder={`${origin}/i/…`}
                    required
                    disabled={busy}
                  />
                </label>
                <button className="button secondary" disabled={busy || offline}>
                  {busy ? 'Verifying…' : 'Verify invitation'}
                </button>
              </form>
            </details>
            <p className="scanner-note">
              <ShieldCheck size={15} /> Scanning verifies. You always confirm
              admission.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
