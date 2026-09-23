import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { signIn, signUp } from '@/app/auth/actions';
export function AuthPage({
  register = false,
  error,
  message,
}: {
  register?: boolean;
  error?: string;
  message?: string;
}) {
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link className="brand" href="/">
          <span className="brand-mark">y</span> yingira.
        </Link>
        <div>
          <span className="eyebrow">EVERY GUEST, WELCOMED.</span>
          <h1>
            Good gatherings
            <br />
            begin with
            <br />
            <em>great care.</em>
          </h1>
          <p>
            Your invitations, your people, your event.
            <br />
            All together in one thoughtful workspace.
          </p>
        </div>
        <span>Built for the moments that bring us together.</span>
      </section>
      <main className="auth-form">
        <Link href="/" className="mobile-brand brand">
          yingira.
        </Link>
        <span className="eyebrow">
          {register ? 'LET’S GET STARTED' : 'WELCOME BACK'}
        </span>
        <h2>{register ? 'Create your account' : 'Your event awaits.'}</h2>
        <p>
          {register
            ? 'Organizers and event team members start here.'
            : 'Sign in to your organizer or event team workspace.'}
        </p>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        <form action={register ? signUp : signIn}>
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              required
              minLength={register ? 12 : 1}
              maxLength={128}
            />
          </label>
          {register && (
            <small>
              Use at least 12 characters. We’ll send a confirmation email.
            </small>
          )}
          <button className="button">
            {register ? 'Create account' : 'Sign in'}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? 'Already have an account?' : 'New to Yingira?'}{' '}
          <Link href={register ? '/login' : '/register'}>
            {register ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </main>
    </div>
  );
}
