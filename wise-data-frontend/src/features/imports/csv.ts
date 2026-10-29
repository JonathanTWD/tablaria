/** Separators spreadsheets use for CSV; Spanish Excel writes ";". */
const SEPARATORS = [";", ",", "\t"] as const;

/**
 * The separator of a CSV file: the one that splits its first line into the
 * most fields, ignoring anything inside quotes.
 */
export function detectSeparator(text: string): string {
  const firstLine = firstRecord(text);
  let best: string = SEPARATORS[0];
  let bestCount = -1;
  for (const separator of SEPARATORS) {
    const count = countOutsideQuotes(firstLine, separator);
    if (count > bestCount) {
      best = separator;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Rows of a CSV as RFC 4180 describes it: quoted fields may hold separators,
 * line breaks and doubled quotes. A leading byte order mark and blank lines
 * are dropped.
 */
export function parseCsv(text: string, separator = detectSeparator(text)): string[][] {
  const source = text.startsWith("﻿") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endRow = () => {
    row.push(field);
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
    row = [];
    field = "";
  };

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") {
        index++;
      }
      endRow();
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    endRow();
  }
  return rows;
}

function firstRecord(text: string): string {
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && (char === "\n" || char === "\r")) {
      return text.slice(0, index);
    }
  }
  return text;
}

function countOutsideQuotes(line: string, separator: string): number {
  let quoted = false;
  let count = 0;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === separator) {
      count++;
    }
  }
  return count;
}

/**
 * The text of a file, as UTF-8 when it is valid UTF-8 and otherwise as
 * Windows-1252, which Excel in Spanish uses for "CSV (delimitado por comas)".
 */
export function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
