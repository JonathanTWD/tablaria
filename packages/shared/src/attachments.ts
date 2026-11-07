/** Photos and documents attached to a record (ADR-039). */
export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_RECORD = 10;
/** What all the records of one space (personal or organization) can hold together. */
export const SPACE_ATTACHMENTS_MAX_BYTES = 50 * 1024 * 1024;
export const ATTACHMENT_NAME_MAX_LENGTH = 120;

export interface Attachment {
  id: string;
  name: string;
  contentType: AttachmentType;
  size: number;
  createdAt: string;
}

export function isImageAttachment(type: AttachmentType): boolean {
  return type !== "application/pdf";
}
