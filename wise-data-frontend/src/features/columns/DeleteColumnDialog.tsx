import type { TableColumn } from "@wisedata/shared";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteColumn } from "@/features/tables/queries";
import { apiErrorMessage } from "@/lib/error-message";

/** Rendered only while open: the parent unmounts it to close. */
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

  const confirm = () =>
    remove.mutate(column.id, {
      onSuccess: () => {
        toast.success(t("columns.deleted", { name: column.name }));
        onOpenChange(false);
      },
    });

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("columns.deleteTitle", { name: column.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("columns.deleteDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        {remove.error && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-9">{t("cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            className="h-9"
            disabled={remove.isPending}
            aria-busy={remove.isPending}
            onClick={confirm}
          >
            {remove.isPending && (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            )}
            {t("columns.delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
