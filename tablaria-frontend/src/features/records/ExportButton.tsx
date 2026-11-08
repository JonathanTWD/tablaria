import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExportRecords } from "./queries";
import type { RecordsView } from "./records-view";

/** Downloads the current view as CSV or as an Excel workbook. */
export function ExportButton({ tableId, view }: { tableId: string; view: RecordsView }) {
  const { t } = useTranslation("records");
  const exportRecords = useExportRecords(tableId, view);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="h-9"
            disabled={exportRecords.isPending}
            aria-busy={exportRecords.isPending}
          />
        }
      >
        {exportRecords.isPending ? (
          <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {t("toolbar.export")}
        <ChevronDown aria-hidden="true" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => exportRecords.mutate("xlsx")}>
          <FileSpreadsheet aria-hidden="true" />
          {t("toolbar.exportXlsx")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportRecords.mutate("csv")}>
          <FileText aria-hidden="true" />
          {t("toolbar.exportCsv")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
