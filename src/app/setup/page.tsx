import Link from 'next/link';
export default function Setup() {
  return (
    <main className="standalone">
      <Link className="brand" href="/">
        yingira.
      </Link>
      <span className="eyebrow">LOCAL DEVELOPMENT</span>
      <h1>Almost ready.</h1>
      <p>
        Connect this application to its Supabase environment to enable accounts
        and events.
      </p>
      <ol>
        <li>Start the local services with the command in README.md.</li>
        <li>Run the local environment setup script.</li>
        <li>Apply the database migration and restart the app.</li>
      </ol>
      <p>No demo data or authentication bypass is enabled automatically.</p>
      <Link className="button" href="/login">
        Check connection
      </Link>
    </main>
  );
}
