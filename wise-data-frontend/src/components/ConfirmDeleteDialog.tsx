import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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

interface ConfirmDeleteDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  /** Shown above the buttons when the deletion failed. */
  error?: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

/** Rendered only while open: the parent unmounts it to close. */
export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onOpenChange,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation("tables");
  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <FormAlert>{error}</FormAlert>}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-9">{t("cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            className="h-9"
            disabled={pending}
            aria-busy={pending}
            onClick={onConfirm}
          >
            {pending && (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            )}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
