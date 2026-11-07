import { Download, Ellipsis, FileUp, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExportCsv } from "./queries";
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
  const exportCsv = useExportCsv(tableId, view);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={className}
            aria-label={t("toolbar.moreLabel")}
            aria-busy={exportCsv.isPending}
          />
        }
      >
        <Ellipsis aria-hidden="true" />
        {t("toolbar.more")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
          <Download aria-hidden="true" />
          {t("toolbar.export")}
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
