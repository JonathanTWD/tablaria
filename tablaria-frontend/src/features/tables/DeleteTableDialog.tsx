import type { TableDetail } from "@tablaria/shared";
import { Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/error-message";
import { useDeleteTable } from "./queries";

interface DeleteTableDialogProps {
  table: TableDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Deleting is permanent, so the user types the table's name to confirm. */
export function DeleteTableDialog({ table, open, onOpenChange }: DeleteTableDialogProps) {
  const { t } = useTranslation("tables");
  const inputId = useId();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState("");
  const remove = useDeleteTable(table.id);
  const confirmed = confirmation.trim() === table.name;

  const changeOpen = (next: boolean) => {
    if (!next) {
      setConfirmation("");
      remove.reset();
    }
    onOpenChange(next);
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirmed) {
      return;
    }
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("delete.deleted", { name: table.name }));
        void navigate("/app", { replace: true });
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <form noValidate onSubmit={onSubmit} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete.title", { name: table.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("delete.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          {remove.error && <FormAlert>{apiErrorMessage(remove.error)}</FormAlert>}
          <Field>
            <FieldLabel htmlFor={inputId} className="block">
              {t("delete.confirmLabel", { name: table.name })}
            </FieldLabel>
            <Input
              id={inputId}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="h-9"
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9">{t("cancel")}</AlertDialogCancel>
            <Button
              type="submit"
              variant="destructive"
              className="h-9"
              disabled={!confirmed || remove.isPending}
              aria-busy={remove.isPending}
            >
              {remove.isPending && (
                <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
              )}
              {t("delete.submit")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
