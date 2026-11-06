import { useQuery } from "@tanstack/react-query";
import { MAX_PAGE_SIZE } from "@tablaria/shared";
import { ArrowLeft, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { QrLabel } from "@/features/qr/QrLabel";
import { recordDetailQuery, recordsQuery } from "@/features/records/queries";
import { applicableView, parseRecordsView } from "@/features/records/records-view";
import { tableQuery } from "@/features/tables/queries";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

/**
 * QR labels ready to print (ADR-038): one record's (`?record=`), or those of
 * the view the table showed, its search, filters and order, up to a page of
 * MAX_PAGE_SIZE. Outside the app's frame, so only the labels are printed.
 */
export default function LabelsPage() {
  const { t } = useTranslation("records");
  const { tableId = "" } = useParams();
  const [params] = useSearchParams();
  const recordId = params.get("record");
  const table = useQuery(tableQuery(tableId));
  const view = table.data
    ? applicableView(parseRecordsView(params), table.data.columns)
    : parseRecordsView(params);
  const many = useQuery({
    ...recordsQuery(tableId, { ...view, page: 1, pageSize: MAX_PAGE_SIZE }),
    enabled: table.isSuccess && recordId === null,
  });
  const one = useQuery({
    ...recordDetailQuery(tableId, recordId ?? ""),
    enabled: recordId !== null,
  });
  const records = recordId === null ? many.data?.data : one.data && [one.data.record];
  const error = table.error ?? (recordId === null ? many.error : one.error);
  // Back to the table as it was, without the record's sheet.
  const back = new URLSearchParams(params);
  back.delete("record");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 print:max-w-none print:p-0">
      <title>{`${t("qr.labelsTitle")} · ${table.data?.name ?? ""} | Tablaria`}</title>
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Link
          to={`/app/tables/${tableId}${back.size > 0 ? `?${back}` : ""}`}
          className={cn(buttonVariants({ variant: "outline" }), "h-9")}
        >
          <ArrowLeft aria-hidden="true" />
          {t("qr.back")}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">
          {t("qr.labelsHeading", { table: table.data?.name ?? "" })}
        </h1>
        <Button className="h-9 sm:ml-auto" onClick={() => window.print()} disabled={!records?.length}>
          <Printer aria-hidden="true" />
          {t("qr.print")}
        </Button>
        <p className="w-full text-sm text-muted-foreground">
          {many.data && many.data.meta.total > MAX_PAGE_SIZE
            ? t("qr.firstOnly", { count: MAX_PAGE_SIZE, total: many.data.meta.total })
            : t("qr.printHint")}
        </p>
      </div>

      {error ? (
        <FormAlert>{apiErrorMessage(error)}</FormAlert>
      ) : !records || !table.data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("qr.none")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
          {records.map((record) => (
            <li key={record.id}>
              <QrLabel
                tableId={tableId}
                tableName={table.data.name}
                columns={table.data.columns}
                record={record}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
