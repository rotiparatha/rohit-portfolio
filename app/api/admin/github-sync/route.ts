import { requireAdmin } from '@/lib/auth';
import { syncRepos } from '@/lib/github';
import { readContent, writeContent } from '@/lib/store';

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { username?: unknown } | null;
  const content = await readContent();
  const username = (typeof body?.username === 'string' ? body.username : content.github.username).trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) return Response.json({ error: 'Enter a valid GitHub username' }, { status: 400 });

  try {
    const repos = await syncRepos(username);
    if (username.toLowerCase() !== content.github.username.toLowerCase()) {
      content.github.featured = [];
      content.github.hidden = [];
    }
    content.github = { ...content.github, username, repos, syncedAt: new Date().toISOString() };
    const saved = await writeContent(content);
    return Response.json({ github: saved.github });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
