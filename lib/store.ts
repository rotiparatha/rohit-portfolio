// Storage for the site content and the published resume.
// - On Vercel (BLOB_READ_WRITE_TOKEN set): a private Vercel Blob store. Content reads are kept in
//   Next's data cache and refreshed only when the admin publishes, so Blob usage stays tiny.
// - Locally: data/content.json and data/resume.pdf on disk.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { get, put } from '@vercel/blob';
import { revalidateTag, unstable_cache } from 'next/cache';
import { defaultContent, sanitizeContent } from './content';
import type { SiteContent } from './types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const RESUME_FILE = path.join(DATA_DIR, 'resume.pdf');

const BLOB_CONTENT = 'site/content.json';
const BLOB_RESUME = 'site/resume.pdf';
const CONTENT_TAG = 'site-content';

const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function isMissing(err: unknown): boolean {
  return (err as NodeJS.ErrnoException)?.code === 'ENOENT';
}

async function writeAtomic(file: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

async function readBlob(pathname: string): Promise<Uint8Array<ArrayBuffer> | null> {
  // useCache: false reads the latest version from storage, not a CDN copy.
  const res = await get(pathname, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  return new Uint8Array(await new Response(res.stream).arrayBuffer());
}

const cachedBlobContent = unstable_cache(
  async (): Promise<string | null> => {
    const bytes = await readBlob(BLOB_CONTENT);
    return bytes ? new TextDecoder().decode(bytes) : null;
  },
  ['site-content'],
  { tags: [CONTENT_TAG] },
);

export async function readContent(): Promise<SiteContent> {
  if (blobEnabled()) {
    const raw = await cachedBlobContent();
    return raw ? sanitizeContent(JSON.parse(raw)) : defaultContent();
  }
  try {
    return sanitizeContent(JSON.parse(await fs.readFile(CONTENT_FILE, 'utf8')));
  } catch (err) {
    if (isMissing(err)) return defaultContent();
    throw err;
  }
}

/** Saves content; must be called from a Route Handler or Server Function (it clears the cache). */
export async function writeContent(content: SiteContent): Promise<SiteContent> {
  const clean = sanitizeContent({ ...content, updatedAt: new Date().toISOString() });
  const json = JSON.stringify(clean, null, 2);
  if (blobEnabled()) {
    await put(BLOB_CONTENT, json, {
      access: 'private',
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    });
    revalidateTag(CONTENT_TAG, { expire: 0 });
  } else {
    await writeAtomic(CONTENT_FILE, json);
  }
  return clean;
}

export async function readResume(): Promise<Uint8Array<ArrayBuffer> | null> {
  if (blobEnabled()) return readBlob(BLOB_RESUME);
  try {
    return new Uint8Array(await fs.readFile(RESUME_FILE));
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

export async function writeResume(pdf: Uint8Array<ArrayBuffer>): Promise<void> {
  if (blobEnabled()) {
    await put(BLOB_RESUME, new Blob([pdf], { type: 'application/pdf' }), {
      access: 'private',
      allowOverwrite: true,
      contentType: 'application/pdf',
      cacheControlMaxAge: 60,
    });
    return;
  }
  await writeAtomic(RESUME_FILE, pdf);
}
