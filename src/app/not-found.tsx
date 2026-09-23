import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="standalone">
      <span className="eyebrow">PAGE UNAVAILABLE</span>
      <h1>We couldn’t find that.</h1>
      <p>The link may be unavailable or you may not have access.</p>
      <Link className="button" href="/dashboard">
        Back to your workspace
      </Link>
    </main>
  );
}
