import { Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useExportCsv } from "./queries";
import type { RecordsView } from "./records-view";

export function ExportButton({ tableId, view }: { tableId: string; view: RecordsView }) {
  const { t } = useTranslation("records");
  const exportCsv = useExportCsv(tableId, view);

  return (
    <Button
      variant="outline"
      className="h-9"
      disabled={exportCsv.isPending}
      aria-busy={exportCsv.isPending}
      onClick={() => exportCsv.mutate()}
    >
      {exportCsv.isPending ? (
        <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      ) : (
        <Download aria-hidden="true" />
      )}
      {t("toolbar.export")}
    </Button>
  );
}
