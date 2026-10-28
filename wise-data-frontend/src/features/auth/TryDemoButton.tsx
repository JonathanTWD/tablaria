import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDelayedFlag } from "@/hooks/use-delayed-flag";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { authApi } from "./api";
import { useStartSession } from "./session";

const WAKING_HINT_DELAY_MS = 3000;

/** Signs in to a temporary account with example tables, no sign-up needed. */
export function TryDemoButton({
  variant = "default",
  className,
}: {
  variant?: "default" | "outline";
  className?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const startSession = useStartSession();
  const demo = useMutation({
    mutationFn: authApi.demo,
    onSuccess: (user) => {
      startSession(user);
      void navigate("/app");
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status === 503
          ? t("demo.busy")
          : apiErrorMessage(error),
      ),
  });
  const waking = useDelayedFlag(demo.isPending, WAKING_HINT_DELAY_MS);

  return (
    <Button
      variant={variant}
      className={className}
      disabled={demo.isPending}
      aria-busy={demo.isPending}
      onClick={() => demo.mutate()}
    >
      {demo.isPending ? (
        <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
      ) : (
        <Sparkles aria-hidden="true" />
      )}
      {waking ? t("demo.waking") : demo.isPending ? t("demo.starting") : t("demo.try")}
    </Button>
  );
}
