import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** Fills the viewport by default; pass a className to size it inside a layout. */
export function FullPageLoader({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-dvh items-center justify-center bg-background text-muted-foreground",
        className,
      )}
    >
      <Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
