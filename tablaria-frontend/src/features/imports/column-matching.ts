import type { TableColumn } from "@tablaria/shared";

/** "Precio (EUR)" → "precio": our export adds the currency to the header. */
function normalize(name: string): string {
  return name
    .replace(/\s*\([A-Z]{3}\)\s*$/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * For each header of the file, the table column with the same name (ignoring
 * case and accents), each used once; null when none matches.
 */
export function matchColumns(headers: string[], columns: TableColumn[]): (string | null)[] {
  const used = new Set<string>();
  return headers.map((header) => {
    const name = normalize(header);
    const column = columns.find((candidate) => !used.has(candidate.id) && normalize(candidate.name) === name);
    if (!column) {
      return null;
    }
    used.add(column.id);
    return column.id;
  });
}
