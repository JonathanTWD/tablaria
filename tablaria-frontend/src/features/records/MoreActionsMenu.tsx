import { Ellipsis, FileSpreadsheet, FileText, FileUp, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExportRecords } from "./queries";
import type { RecordsView } from "./records-view";

/**
 * The table's occasional actions (export, labels, import) when the toolbar
 * has no room to show them as buttons.
 */
export function MoreActionsMenu({
  tableId,
  view,
  labelsUrl,
  onImport,
  className,
}: {
  tableId: string;
  view: RecordsView;
  labelsUrl: string;
  /** Editors only: opens the import wizard. */
  onImport?: () => void;
  className?: string;
}) {
  const { t } = useTranslation("records");
  const navigate = useNavigate();
  const exportRecords = useExportRecords(tableId, view);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={className}
            aria-label={t("toolbar.moreLabel")}
            aria-busy={exportRecords.isPending}
          />
        }
      >
        <Ellipsis aria-hidden="true" />
        {t("toolbar.more")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem disabled={exportRecords.isPending} onClick={() => exportRecords.mutate("xlsx")}>
          <FileSpreadsheet aria-hidden="true" />
          {t("toolbar.exportToXlsx")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={exportRecords.isPending} onClick={() => exportRecords.mutate("csv")}>
          <FileText aria-hidden="true" />
          {t("toolbar.exportToCsv")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void navigate(labelsUrl)}>
          <QrCode aria-hidden="true" />
          {t("qr.labels")}
        </DropdownMenuItem>
        {onImport && (
          <DropdownMenuItem onClick={onImport}>
            <FileUp aria-hidden="true" />
            {t("toolbar.import")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
