import {
  ATTACHMENT_NAME_MAX_LENGTH,
  type AttachmentType,
} from '@tablaria/shared';

/**
 * The type a file really is, read from its first bytes: the name and the
 * Content-Type header come from the client and prove nothing. Null for
 * anything that is not an allowed type.
 */
export function detectAttachmentType(body: Buffer): AttachmentType | null {
  if (startsWith(body, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (startsWith(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (
    body.subarray(0, 4).toString('latin1') === 'RIFF' &&
    body.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (body.subarray(0, 5).toString('latin1') === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

function startsWith(body: Buffer, bytes: number[]): boolean {
  return bytes.every((byte, index) => body[index] === byte);
}

/** A name to show and to download under: no folders, no control characters. */
export function cleanFileName(name: string | undefined): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return clean.slice(0, ATTACHMENT_NAME_MAX_LENGTH) || 'archivo';
}
