import Link from 'next/link';
import { ArrowRight, Check, ScanLine, ShieldCheck, Users } from 'lucide-react';
export default function Home() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link className="brand" href="/">
          <span className="brand-mark">y</span> yingira.
        </Link>
        <div>
          <Link href="/login" className="text-button">
            Sign in
          </Link>
          <Link href="/register" className="button small">
            Create an account <ArrowRight size={16} />
          </Link>
        </div>
      </nav>
      <main className="hero">
        <div>
          <span className="eyebrow">FROM FIRST INVITATION TO FINAL GUEST</span>
          <h1>
            Make every
            <br />
            entrance feel
            <br />
            <em>like a welcome.</em>
          </h1>
          <p>
            Beautiful invitations. A guest list that stays in sync. Confident
            check-in, even when everyone arrives at once.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/register">
              Plan your first event <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="text-button">
              Joining an event team?
            </Link>
          </div>
          <div className="hero-proof">
            <ShieldCheck size={17} /> Secure invitations <span>·</span>
            <Users size={17} /> One place for your team
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Invitation and admission illustration"
        >
          <div className="art-circle" />
          <div className="invitation-sample">
            <span className="eyebrow">YOU ARE WARMLY INVITED</span>
            <div className="floral">✳</div>
            <h2>
              A day to
              <br />
              <em>remember.</em>
            </h2>
            <div className="fine-line" />
            <p>
              Good company. Beautiful moments.
              <br />A celebration made for you.
            </p>
            <div className="sample-label">YOUR INVITATION, REIMAGINED</div>
          </div>
          <div className="sample-receipt">
            <span className="success-icon">
              <Check size={20} />
            </span>
            <div>
              <strong>Every detail, together.</strong>
              <p>Guest · Invitation · Table · Arrival</p>
            </div>
            <ScanLine size={24} />
          </div>
        </div>
      </main>
      <div className="landing-bottom">
        <span>
          01 <strong>Invite thoughtfully.</strong>
        </span>
        <span>
          02 <strong>Welcome confidently.</strong>
        </span>
        <span>
          03 <strong>Stay in the moment.</strong>
        </span>
      </div>
    </div>
  );
}
