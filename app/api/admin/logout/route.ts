import { endSession, sameOrigin } from '@/lib/auth';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Bad origin' }, { status: 403 });
  await endSession();
  return Response.json({ ok: true });
}
