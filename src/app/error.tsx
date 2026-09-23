'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Let’s try that again.</h1>
      <p>
        We couldn’t load this page. Your session may have expired or the
        connection may be unavailable.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <a href="/login" className="text-button">
        Sign in
      </a>
    </main>
  );
}
