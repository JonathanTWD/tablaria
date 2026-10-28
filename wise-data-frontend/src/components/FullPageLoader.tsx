import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDelayedFlag } from "@/hooks/use-delayed-flag";
import { cn } from "@/lib/utils";

// Long enough that a normal load never shows it; a sleeping free-tier API takes far longer.
const WAKING_HINT_DELAY_MS = 3000;

/** Fills the viewport by default; pass a className to size it inside a layout. */
export function FullPageLoader({ className }: { className?: string }) {
  const { t } = useTranslation();
  const slow = useDelayedFlag(true, WAKING_HINT_DELAY_MS);

  return (
    <div
      role="status"
      className={cn(
        "flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center text-muted-foreground",
        className,
      )}
    >
      <Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
      {slow ? (
        <p className="max-w-xs text-sm">{t("waking")}</p>
      ) : (
        <span className="sr-only">{t("loading")}</span>
      )}
    </div>
  );
}
