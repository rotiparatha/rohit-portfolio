// Google OpenID Connect: authorization-code flow with PKCE, state and nonce.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export const CALLBACK_PATH = '/api/auth/google/callback';

/** Public base URL: SITE_URL when set (needed behind some proxies), else the request's origin. */
export function siteUrl(request: Request): string {
  return process.env.SITE_URL?.replace(/\/+$/, '') || new URL(request.url).origin;
}

export function authorizationUrl(opts: { redirectUri: string; state: string; challenge: string; nonce: string; loginHint?: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: 'S256',
    nonce: opts.nonce,
    prompt: 'select_account',
  });
  if (opts.loginHint) params.set('login_hint', opts.loginHint);
  return `${AUTH_URL}?${params}`;
}

/** Exchanges the authorization code for an ID token. */
export async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: unknown; error?: string; error_description?: string };
  if (!res.ok || typeof body.id_token !== 'string') {
    throw new Error(`Google token exchange failed (${res.status}): ${body.error_description || body.error || 'no id_token'}`);
  }
  return body.id_token;
}

export type EmailCheck = { ok: true; email: string } | { ok: false; reason: 'invalid' | 'not_allowed' };

/**
 * Validates an ID token that came straight from Google's token endpoint. Because it
 * arrived over TLS in exchange for our client secret, the issuer is authenticated by
 * TLS and the signature need not be checked (OpenID Connect Core 3.1.3.7).
 */
export function checkIdToken(idToken: string, opts: { clientId: string; nonce: string; allowed: string[]; now?: number }): EmailCheck {
  const invalid: EmailCheck = { ok: false, reason: 'invalid' };
  const parts = idToken.split('.');
  if (parts.length !== 3) return invalid;
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return invalid;
  }
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = opts.now ?? Date.now();
  if (!ISSUERS.includes(String(claims.iss))) return invalid;
  if (!opts.clientId || !aud.includes(opts.clientId)) return invalid;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < now) return invalid;
  if (!opts.nonce || claims.nonce !== opts.nonce) return invalid;
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
  const verified = claims.email_verified === true || claims.email_verified === 'true';
  if (!email || !verified || !opts.allowed.includes(email)) return { ok: false, reason: 'not_allowed' };
  return { ok: true, email };
}
