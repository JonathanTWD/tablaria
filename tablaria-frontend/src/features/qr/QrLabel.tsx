import type { TableColumn, TableRecord } from "@tablaria/shared";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { QrCode } from "./QrCode";
import { labelLines, recordUrl } from "./record-label";

/** A printable label: the record's QR code with its name and reference. */
export function QrLabel({
  tableId,
  tableName,
  columns,
  record,
  className,
}: {
  tableId: string;
  tableName: string;
  columns: TableColumn[];
  record: TableRecord;
  className?: string;
}) {
  const { t } = useTranslation("records");
  const { name, reference } = labelLines(columns, record);
  const shown = name || t("table.untitled");

  return (
    <figure
      className={cn(
        "flex items-center gap-3 rounded-lg border border-zinc-300 bg-white p-3 text-black break-inside-avoid",
        className,
      )}
    >
      <QrCode
        value={recordUrl(tableId, record.id)}
        label={t("qr.codeOf", { name: shown })}
        className="size-24 shrink-0"
      />
      <figcaption className="min-w-0">
        <p className="line-clamp-3 text-sm leading-snug font-semibold">{shown}</p>
        {reference && <p className="mt-1 font-mono text-xs">{reference}</p>}
        <p className="mt-1 truncate text-[0.65rem] text-zinc-600">{tableName}</p>
      </figcaption>
    </figure>
  );
}
