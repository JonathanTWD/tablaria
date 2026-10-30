import type { TableColumn } from "@tablaria/shared";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useDeleteColumn } from "@/features/tables/queries";
import { apiErrorMessage } from "@/lib/error-message";

export function DeleteColumnDialog({
  tableId,
  column,
  onOpenChange,
}: {
  tableId: string;
  column: TableColumn;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("tables");
  const remove = useDeleteColumn(tableId);

  return (
    <ConfirmDeleteDialog
      title={t("columns.deleteTitle", { name: column.name })}
      description={t("columns.deleteDescription")}
      confirmLabel={t("columns.delete")}
      pending={remove.isPending}
      error={remove.error && apiErrorMessage(remove.error)}
      onConfirm={() =>
        remove.mutate(column.id, {
          onSuccess: () => {
            toast.success(t("columns.deleted", { name: column.name }));
            onOpenChange(false);
          },
        })
      }
      onOpenChange={onOpenChange}
    />
  );
}
