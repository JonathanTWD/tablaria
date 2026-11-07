import { useQuery } from "@tanstack/react-query";
import type { TableDetail, TableRecord } from "@tablaria/shared";
import { ArrowDownUp, Download, Pencil, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useCellFormatter } from "@/features/columns/format-value";
import { RecordAttachments } from "@/features/attachments/RecordAttachments";
import { downloadQrPng } from "@/features/qr/qr-png";
import { QrLabel } from "@/features/qr/QrLabel";
import { recordUrl } from "@/features/qr/record-label";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { ReadOnlyCell } from "./EditableCell";
import { recordDetailQuery } from "./queries";
import { shownColumn } from "./shown-column";

/**
 * One record on its own (ADR-038): every cell, computed ones included, and
 * its QR label to print or download. What a scanned label opens.
 */
export function RecordSheet({
  table,
  recordId,
  canEdit,
  onClose,
  onEdit,
  onStock,
}: {
  table: TableDetail;
  recordId: string;
  /** Editors can add and remove attachments. */
  canEdit: boolean;
  onClose: () => void;
  /** Editors only: opens the record's form. */
  onEdit?: (record: TableRecord) => void;
  /** Tables with stock columns: opens the record's movements. */
  onStock?: (record: TableRecord) => void;
}) {
  const { t } = useTranslation(["records", "common"]);
  const format = useCellFormatter();
  const detail = useQuery(recordDetailQuery(table.id, recordId));
  const record = detail.data?.record;
  const name = record
    ? format(table.columns[0], record.data[table.columns[0]?.id]) || t("table.untitled")
    : "";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" closeLabel={t("common:close")} className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <div className="flex flex-col gap-5 p-4 sm:p-6">
          <div>
            <SheetTitle>{name || t("qr.sheetTitle")}</SheetTitle>
            <SheetDescription>{t("qr.sheetDescription", { table: table.name })}</SheetDescription>
          </div>

          {detail.isPending ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : detail.isError ? (
            <FormAlert>
              {detail.error instanceof ApiError && detail.error.status === 404
                ? t("qr.notFound")
                : apiErrorMessage(detail.error)}
            </FormAlert>
          ) : (
            <>
              <QrLabel
                tableId={table.id}
                tableName={table.name}
                columns={table.columns}
                record={detail.data.record}
              />
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/app/tables/${table.id}/labels?${new URLSearchParams({ record: recordId })}`}
                  className={cn(buttonVariants({ variant: "outline" }), "h-9")}
                >
                  <Printer aria-hidden="true" />
                  {t("qr.printOne")}
                </Link>
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => void downloadQrPng(recordUrl(table.id, recordId), `qr-${name || recordId}.png`)}
                >
                  <Download aria-hidden="true" />
                  {t("qr.download")}
                </Button>
                {onStock && (
                  <Button variant="outline" className="h-9" onClick={() => onStock(detail.data.record)}>
                    <ArrowDownUp aria-hidden="true" />
                    {t("table.stock")}
                  </Button>
                )}
                {onEdit && (
                  <Button className="h-9" onClick={() => onEdit(detail.data.record)}>
                    <Pencil aria-hidden="true" />
                    {t("table.edit")}
                  </Button>
                )}
              </div>

              <dl className="divide-y divide-border rounded-lg border border-border">
                {table.columns.map((column) => {
                  const hidden =
                    (column.type === "lookup" && !(column.id in table.lookupTargets)) ||
                    (column.type === "rollup" && !(column.id in table.rollupTargets));
                  return (
                    <div key={column.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 px-3 py-1.5">
                      <dt className="truncate text-sm text-muted-foreground" title={column.name}>
                        {column.name}
                      </dt>
                      <dd className="min-w-0">
                        {hidden ? (
                          <span className="block h-8" />
                        ) : (
                          <ReadOnlyCell
                            column={shownColumn(table, column)}
                            value={detail.data.record.data[column.id]}
                            format={format}
                            linked={detail.data.linked}
                          />
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>

              <RecordAttachments tableId={table.id} recordId={recordId} canEdit={canEdit} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
