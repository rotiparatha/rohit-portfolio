// Vercel functions accept request bodies up to 4.5 MB.
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

/** Reads an uploaded PDF from form data, or returns an error message. */
export async function readPdfUpload(value: FormDataEntryValue | null): Promise<{ bytes: Uint8Array<ArrayBuffer>; name: string } | { error: string }> {
  if (!(value instanceof File) || value.size === 0) return { error: 'Attach a PDF file.' };
  if (value.size > MAX_PDF_BYTES) return { error: 'That PDF is over 4 MB.' };
  const bytes = new Uint8Array(await value.arrayBuffer());
  // Every PDF starts with "%PDF".
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    return { error: "That file isn't a PDF." };
  }
  return { bytes, name: value.name.replace(/[^\w.\- ]+/g, '').slice(0, 120) || 'resume.pdf' };
}
