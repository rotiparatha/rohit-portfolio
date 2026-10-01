// Admin auth: "Sign in with Google", allowed only for the address(es) in ADMIN_EMAIL.
// Sessions and the short-lived OAuth state live in HMAC-signed cookies.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'rp_admin';
const OAUTH_COOKIE = 'rp_oauth';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_SECONDS = 10 * 60;
const OAUTH_PATH = '/api/auth';

export type OAuthState = { state: string; verifier: string; nonce: string };

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function googleConfigured(): boolean {
  return (
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) &&
    adminEmails().length > 0 &&
    (process.env.SESSION_SECRET?.length ?? 0) >= 32
  );
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters (see .env.example).');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  // Hash first so the comparison is constant-time regardless of input length.
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Signs data plus an expiry into a cookie-safe string. */
export function seal(data: object, seconds: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + seconds * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function unseal<T extends object>(token: string | undefined): T | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T & { exp?: unknown };
    return typeof data.exp === 'number' && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

const random = (bytes = 32) => randomBytes(bytes).toString('base64url');

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** The signed-in admin's email, or null. Removing an address from ADMIN_EMAIL ends its sessions. */
export async function currentAdmin(): Promise<string | null> {
  if (!googleConfigured()) return null;
  const session = unseal<{ email?: unknown }>((await cookies()).get(SESSION_COOKIE)?.value);
  const email = typeof session?.email === 'string' ? session.email : '';
  return email && adminEmails().includes(email) ? email : null;
}

export async function isAdmin(): Promise<boolean> {
  return (await currentAdmin()) !== null;
}

export async function startSession(email: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, seal({ email }, SESSION_SECONDS), {
    httpOnly: true,
    // "lax" so the cookie survives the redirect back from Google; admin writes are
    // additionally protected by the Origin check in requireAdmin().
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Creates the state/PKCE/nonce for one Google round-trip and remembers it in a cookie. */
export async function beginOAuth(): Promise<OAuthState> {
  const st: OAuthState = { state: random(), verifier: random(48), nonce: random() };
  (await cookies()).set(OAUTH_COOKIE, seal(st, OAUTH_SECONDS), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: OAUTH_PATH,
    maxAge: OAUTH_SECONDS,
  });
  return st;
}

/** Reads and clears the OAuth cookie (it is single-use). */
export async function takeOAuthState(): Promise<OAuthState | null> {
  const jar = await cookies();
  const st = unseal<OAuthState>(jar.get(OAUTH_COOKIE)?.value);
  jar.set(OAUTH_COOKIE, '', { path: OAUTH_PATH, maxAge: 0 });
  return st;
}

/** Rejects cross-site writes: the Origin header (when sent) must match the host. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

/** Guard for admin API routes; returns an error response, or null when allowed. */
export async function requireAdmin(request: Request): Promise<Response | null> {
  if (!sameOrigin(request)) return Response.json({ error: 'Bad origin' }, { status: 403 });
  if (!(await isAdmin())) return Response.json({ error: 'Not signed in' }, { status: 401 });
  return null;
}
