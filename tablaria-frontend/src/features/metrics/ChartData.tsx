/** One mark of a chart: what it is and its value, already formatted. */
export interface ChartRow {
  key: string;
  label: string;
  value: number;
  display: string;
  fill: string;
}

/**
 * The numbers behind a chart as a table for screen readers: the drawing
 * itself is hidden from them (WCAG 1.1.1).
 */
export function ChartData({
  caption,
  labelHeader,
  valueHeader,
  rows,
}: {
  caption: string;
  labelHeader: string;
  valueHeader: string;
  rows: ChartRow[];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{labelHeader}</th>
          <th scope="col">{valueHeader}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.label}</th>
            <td>{row.display}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
