/** What a scanned code means to Tablaria. */
export type ScanResult =
  /** A record's QR label (ADR-038): the path of its table, with the record open. */
  | { kind: "record"; tableId: string; recordId: string; path: string }
  /** Anything else, such as a product's barcode: a value to look for. */
  | { kind: "code"; value: string };

const RECORD_PATH = /^\/app\/tables\/([0-9a-f-]{36})\/?$/i;

/** Only labels of this same site open a record; any other link is just text. */
export function interpretScan(raw: string, origin = window.location.origin): ScanResult {
  const value = raw.trim();
  try {
    const url = new URL(value);
    const tableId = url.pathname.match(RECORD_PATH)?.[1];
    const recordId = url.searchParams.get("record");
    if (url.origin === origin && tableId && recordId) {
      return { kind: "record", tableId, recordId, path: `${url.pathname}${url.search}` };
    }
  } catch {
    // Not a URL: a barcode or a typed code.
  }
  return { kind: "code", value };
}
