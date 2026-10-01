import { requireAdmin } from '@/lib/auth';
import { sanitizeContent } from '@/lib/content';
import { syncRepos } from '@/lib/github';
import { readPdfUpload } from '@/lib/pdf-upload';
import { readContent, writeContent, writeResume } from '@/lib/store';

// Saves the whole site content; a "resume" file in the form also replaces the published PDF.
export async function PUT(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const form = await request.formData().catch(() => null);
  const raw = form?.get('content');
  if (typeof raw !== 'string') return Response.json({ error: 'Missing content' }, { status: 400 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Content is not valid JSON' }, { status: 400 });
  }

  const content = sanitizeContent(parsed);
  const current = await readContent();
  content.resume = current.resume;

  const file = form?.get('resume') ?? null;
  if (file instanceof File && file.size > 0) {
    const upload = await readPdfUpload(file);
    if ('error' in upload) return Response.json({ error: upload.error }, { status: 400 });
    await writeResume(upload.bytes);
    content.resume = { fileName: upload.name, uploadedAt: new Date().toISOString() };
  }

  let warning = '';
  if (content.github.username && !content.github.repos.length) {
    try {
      content.github.repos = await syncRepos(content.github.username);
      content.github.syncedAt = new Date().toISOString();
    } catch (err) {
      warning = `Saved, but GitHub sync failed: ${(err as Error).message}`;
    }
  }

  const saved = await writeContent(content);
  return Response.json({ content: saved, warning });
}
