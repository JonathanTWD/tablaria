import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function FullPageLoader() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground"
    >
      <Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
