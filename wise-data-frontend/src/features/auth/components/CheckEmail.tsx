import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { genericErrorMessage } from "@/lib/error-message";
import { authApi } from "../api";
import { AuthHeading } from "./AuthHeading";

/** Shown after sign-up: the answer is the same whether or not the address was new. */
export function CheckEmail({ email, onUseAnother }: { email: string; onUseAnother: () => void }) {
  const { t } = useTranslation("auth");
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => toast.success(t("resend.sent")),
    onError: (error) => toast.error(genericErrorMessage(error) ?? t("resend.sent")),
  });

  return (
    <div>
      <MailCheck aria-hidden="true" className="mb-6 size-10 text-primary" strokeWidth={1.5} />
      <AuthHeading
        title={t("checkEmail.title")}
        description={t("checkEmail.description", { email })}
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="h-10 px-4"
          disabled={resend.isPending}
          onClick={() => resend.mutate({ email })}
        >
          {t("checkEmail.resend")}
        </Button>
        <Button variant="ghost" className="h-10 px-4" onClick={onUseAnother}>
          {t("checkEmail.useAnother")}
        </Button>
      </div>
    </div>
  );
}
