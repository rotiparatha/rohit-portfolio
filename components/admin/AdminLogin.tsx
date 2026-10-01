import Link from 'next/link';
import styles from './admin.module.css';

const MESSAGES: Record<string, string> = {
  setup: 'Google sign-in isn’t set up on this server yet.',
  not_allowed: 'That Google account isn’t allowed to manage this site.',
  cancelled: 'Sign-in was cancelled.',
  expired: 'That sign-in attempt expired. Please try again.',
  google: 'Google sign-in failed. Check the client ID, secret and redirect URI.',
  invalid: 'Google returned an invalid sign-in. Please try again.',
};

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function AdminLogin({ configured, error }: { configured: boolean; error: string }) {
  const message = MESSAGES[error] ?? (error ? 'Sign-in failed. Please try again.' : '');
  return (
    <main className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <Link href="/" className={styles.back}>
          ← Back to site
        </Link>
        <h1 className={styles.loginTitle}>Admin</h1>
        <p className={styles.muted}>Only the site owner&apos;s Google account can sign in.</p>
        {message && (
          <p className={styles.error} role="alert">
            {message}
          </p>
        )}
        {configured ? (
          // A full page navigation (not a client-side link): the route redirects to Google.
          <a href="/api/auth/google" className={styles.googleBtn}>
            <GoogleMark />
            Sign in with Google
          </a>
        ) : (
          <p className={styles.error}>
            Add <code>ADMIN_EMAIL</code>, <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> and{' '}
            <code>SESSION_SECRET</code> to <code>.env.local</code>, then restart the server. The README has the Google
            setup steps.
          </p>
        )}
      </div>
    </main>
  );
}
