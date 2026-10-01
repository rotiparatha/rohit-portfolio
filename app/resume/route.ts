import { readContent, readResume } from '@/lib/store';

export async function GET() {
  const pdf = await readResume();
  if (!pdf) return new Response('No resume has been uploaded yet.', { status: 404 });
  const { profile } = await readContent();
  const fileName = `${(profile.name || 'Resume').replace(/[^\w]+/g, '_')}_Resume.pdf`;
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-cache',
    },
  });
}
