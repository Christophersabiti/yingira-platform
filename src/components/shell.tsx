import Link from 'next/link';
import { ArrowUpRight, CalendarDays, ScanLine, Sparkles } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
export function Shell({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string;
}) {
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">y</span> yingira
          <span className="brand-dot">.</span>
        </Link>
        <div className="sidebar-label">YOUR WORKSPACE</div>
        <Link className="nav-link active" href="/dashboard">
          <CalendarDays size={19} /> Events <ArrowUpRight size={15} />
        </Link>
        <div className="sidebar-note">
          <ScanLine size={24} />
          <h3>
            A warm welcome.
            <br />A well-run entrance.
          </h3>
          <p>Open an event to manage invitations or launch its gate scanner.</p>
        </div>
        <div className="sidebar-footer">
          <span className="avatar">{email.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>My account</strong>
            <span className="email">{email}</span>
          </div>
          <form action={signOut}>
            <button className="text-button">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <span>
            <Sparkles size={14} /> MADE FOR MEANINGFUL GATHERINGS
          </span>
          <div className="topbar-account">
            <span className="topbar-status">Online check-in</span>
            <form action={signOut}>
              <button className="text-button">Sign out</button>
            </form>
          </div>
        </header>
        <main>{children}</main>
        <footer className="workspace-footer">
          Yingira · Every guest, welcomed.
        </footer>
      </div>
    </div>
  );
}
