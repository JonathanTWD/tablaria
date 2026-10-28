import { cn } from "@/lib/utils";

export interface BarChartRow {
  key: string;
  label: string;
  value: number;
  /** The value as the user reads it, e.g. "1.240,50 €". */
  display: string;
  /** Tailwind fill class for the bar; the primary color by default. */
  fillClassName?: string;
}

/**
 * Horizontal bars drawn as a table: screen readers read the labels and
 * values as a normal table, and the bars are decoration on top.
 */
export function BarChart({
  caption,
  valueHeader,
  labelHeader,
  rows,
}: {
  caption: string;
  labelHeader: string;
  valueHeader: string;
  rows: BarChartRow[];
}) {
  const max = Math.max(0, ...rows.map(({ value }) => value));

  return (
    <table className="w-full table-fixed border-separate border-spacing-y-1.5 text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">{labelHeader}</th>
          <th scope="col">{valueHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th
              scope="row"
              title={row.label}
              className="w-2/5 truncate pr-3 text-left font-normal sm:w-1/3"
            >
              {row.label}
            </th>
            <td>
              <span className="flex items-center gap-3">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                  className="h-3 min-w-0 flex-1 overflow-hidden rounded-sm"
                >
                  <rect width="100" height="10" className="fill-muted" />
                  <rect
                    width={max > 0 ? Math.max(0, (row.value / max) * 100) : 0}
                    height="10"
                    className={cn("fill-primary", row.fillClassName)}
                  />
                </svg>
                <span className="w-24 shrink-0 text-right font-medium tabular-nums">
                  {row.display}
                </span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
