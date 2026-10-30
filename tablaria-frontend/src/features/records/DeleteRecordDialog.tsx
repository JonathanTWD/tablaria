import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { apiErrorMessage } from "@/lib/error-message";
import { useDeleteRecord } from "./queries";

export function DeleteRecordDialog({
  tableId,
  recordId,
  label,
  onOpenChange,
}: {
  tableId: string;
  recordId: string;
  /** How the user recognises the record, e.g. its first cell. */
  label: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("records");
  const remove = useDeleteRecord(tableId);

  return (
    <ConfirmDeleteDialog
      title={t("delete.title", { label })}
      description={t("delete.description")}
      confirmLabel={t("delete.submit")}
      pending={remove.isPending}
      error={remove.error && apiErrorMessage(remove.error)}
      onConfirm={() =>
        remove.mutate(recordId, {
          onSuccess: () => {
            toast.success(t("delete.deleted"));
            onOpenChange(false);
          },
        })
      }
      onOpenChange={onOpenChange}
    />
  );
}
