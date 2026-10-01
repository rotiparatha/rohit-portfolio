import { requireAdmin } from '@/lib/auth';
import { readPdfUpload } from '@/lib/pdf-upload';
import { parseResume } from '@/lib/resume/parse';

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const form = await request.formData().catch(() => null);
  const upload = await readPdfUpload(form?.get('file') ?? null);
  if ('error' in upload) return Response.json({ error: upload.error }, { status: 400 });

  try {
    return Response.json(await parseResume(upload.bytes));
  } catch (err) {
    console.error('Resume parse failed', err);
    return Response.json({ error: 'Could not read this PDF. Is it password-protected or damaged?' }, { status: 422 });
  }
}
