import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import { useLogout, useSession } from "./session";

/** Reminds demo visitors that the account and its data are temporary. */
export function DemoBanner() {
  const { t, i18n } = useTranslation("app");
  const { data: user } = useSession();
  const logout = useLogout();

  if (!user?.demoExpiresAt) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-primary/20 bg-primary/8 px-4 py-2.5 text-sm sm:px-8">
      <p className="flex min-w-0 flex-1 items-center gap-2">
        <Sparkles aria-hidden="true" className="size-4 shrink-0 text-primary" />
        {t("demoBanner.text", {
          time: formatRelativeTime(user.demoExpiresAt, i18n.language),
        })}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, { onError: () => toast.error(t("logoutError")) })
        }
      >
        {t("demoBanner.exit")}
      </Button>
    </div>
  );
}
