import { useMutation } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
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
import { PasswordInput } from "@/features/auth/components/PasswordInput";
import { useEndSession } from "@/features/auth/session";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { accountApi } from "./api";

/** Deleting the account, behind its password; it can't be undone. */
export function DeleteAccountSection() {
  const { t } = useTranslation(["app", "tables"]);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm leading-6 text-muted-foreground">{t("settings.delete.description")}</p>
      <Button variant="destructive" className="h-10 px-4" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" />
        {t("settings.delete.open")}
      </Button>
      {/* Mounted only while open, so the password never outlives the dialog. */}
      {open && <DeleteAccountDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(["app", "tables"]);
  const ids = useId();
  const [password, setPassword] = useState("");
  const endSession = useEndSession();
  const remove = useMutation({
    mutationFn: accountApi.remove,
    onSuccess: () => {
      toast.success(t("settings.delete.done"));
      // RequireAuth sends the browser to the login page.
      endSession();
    },
  });

  // 409: organizations only this person owns, while others still use them.
  const blocking =
    remove.error instanceof ApiError && remove.error.status === 409
      ? (remove.error.body?.details ?? [])
      : [];
  const error =
    remove.error &&
    blocking.length === 0 &&
    (remove.error instanceof ApiError && remove.error.status === 422
      ? t("settings.password.wrong")
      : apiErrorMessage(remove.error));

  return (
    <AlertDialog open onOpenChange={(next) => !next && onClose()}>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("settings.delete.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("settings.delete.confirm")}</AlertDialogDescription>
        </AlertDialogHeader>
        <form
          id={`${ids}-form`}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (password) {
              remove.mutate({ password });
            }
          }}
          className="flex flex-col gap-4"
        >
          {error && <FormAlert>{error}</FormAlert>}
          {blocking.length > 0 && (
            <FormAlert>
              <span className="block">{t("settings.delete.blocked")}</span>
              <ul className="mt-1 list-disc pl-5">
                {blocking.map(({ path, message }) => (
                  <li key={path}>
                    <Link
                      to={`/app/organizations/${path}`}
                      className="font-medium underline underline-offset-4"
                    >
                      {message}
                    </Link>
                  </li>
                ))}
              </ul>
            </FormAlert>
          )}
          <FormField id={`${ids}-password`} label={t("settings.delete.password")}>
            <PasswordInput
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
        </form>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-9">{t("tables:cancel")}</AlertDialogCancel>
          <Button
            type="submit"
            form={`${ids}-form`}
            variant="destructive"
            className="h-9"
            disabled={!password || remove.isPending}
            aria-busy={remove.isPending}
          >
            {remove.isPending && (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            )}
            {t("settings.delete.submit")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
