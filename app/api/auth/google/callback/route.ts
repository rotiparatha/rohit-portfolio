import { NextResponse, type NextRequest } from 'next/server';
import { adminEmails, googleConfigured, safeEqual, startSession, takeOAuthState } from '@/lib/auth';
import { CALLBACK_PATH, checkIdToken, exchangeCode, siteUrl } from '@/lib/google';

// Google sends the browser back here with ?code&state (or ?error when the user cancels).
export async function GET(request: NextRequest) {
  const base = siteUrl(request);
  const fail = (code: string) => NextResponse.redirect(`${base}/admin?error=${code}`);
  if (!googleConfigured()) return fail('setup');

  const params = request.nextUrl.searchParams;
  const st = await takeOAuthState();
  if (params.get('error')) return fail('cancelled');
  const code = params.get('code');
  const state = params.get('state');
  if (!st || !code || !state || !safeEqual(state, st.state)) return fail('expired');

  let idToken: string;
  try {
    idToken = await exchangeCode(code, st.verifier, `${base}${CALLBACK_PATH}`);
  } catch (err) {
    console.error(err);
    return fail('google');
  }

  const result = checkIdToken(idToken, {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    nonce: st.nonce,
    allowed: adminEmails(),
  });
  if (!result.ok) return fail(result.reason);

  await startSession(result.email);
  return NextResponse.redirect(`${base}/admin`);
}
