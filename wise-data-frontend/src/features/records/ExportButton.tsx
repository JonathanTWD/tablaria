import { useMutation } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/error-message";
import { recordsApi } from "./api";
import type { RecordsView } from "./records-view";

/** Downloads every record that matches the current search, filters and sort. */
export function ExportButton({ tableId, view }: { tableId: string; view: RecordsView }) {
  const { t } = useTranslation("records");
  const exportCsv = useMutation({
    mutationFn: () => recordsApi.exportCsv(tableId, view),
    onError: (error) => toast.error(t("toolbar.exportError", { message: apiErrorMessage(error) })),
  });

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
