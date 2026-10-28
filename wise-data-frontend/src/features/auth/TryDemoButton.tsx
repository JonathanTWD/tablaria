import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { useDelayedFlag } from "@/hooks/use-delayed-flag";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { authApi } from "./api";
import { useSession, useStartSession } from "./session";

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
  const { data: user } = useSession();

  // Starting a demo replaces the session, so someone already signed in goes to the app instead.
  if (user) {
    return (
      <Link to="/app" className={cn(buttonVariants({ variant }), className)}>
        {t("demo.openApp")}
      </Link>
    );
  }

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
