import { z } from "zod";
import type { TableColumn } from "./column-types.js";
import type { Paginated, TableRecord } from "./records.js";

/** Header that carries a public link's token: never the URL, which servers log (ADR-026). */
export const PUBLIC_TOKEN_HEADER = "x-public-token";

/** The shape `generateSecureToken` produces (32 random bytes, base64url). */
export const publicTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** A table's read-only link, as its admins see it. The token is shown once, on creation. */
export interface PublicLinkStatus {
  enabled: boolean;
  createdAt: string | null;
}

export interface CreatedPublicLink {
  /** Goes after the # of the public page's address. */
  token: string;
  createdAt: string;
}

/** What anyone with the link sees: the table without relation columns, read-only. */
export interface PublicTable {
  name: string;
  description: string | null;
  columns: TableColumn[];
  records: Paginated<TableRecord>;
}
