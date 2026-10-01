import { NextResponse } from 'next/server';
import { adminEmails, beginOAuth, googleConfigured, pkceChallenge } from '@/lib/auth';
import { authorizationUrl, CALLBACK_PATH, siteUrl } from '@/lib/google';

// Starts "Sign in with Google": remembers state/PKCE/nonce in a cookie and sends the browser to Google.
export async function GET(request: Request) {
  const base = siteUrl(request);
  if (!googleConfigured()) return NextResponse.redirect(`${base}/admin?error=setup`);
  const st = await beginOAuth();
  return NextResponse.redirect(
    authorizationUrl({
      redirectUri: `${base}${CALLBACK_PATH}`,
      state: st.state,
      challenge: pkceChallenge(st.verifier),
      nonce: st.nonce,
      loginHint: adminEmails()[0],
    }),
  );
}
