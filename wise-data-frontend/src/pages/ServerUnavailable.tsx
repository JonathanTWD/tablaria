import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function ServerUnavailable({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <title>{t("serverUnavailable.title")}</title>
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("serverUnavailable.title")}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t("serverUnavailable.description")}
        </p>
        <Button className="mt-6 h-10 px-4" onClick={onRetry}>
          {t("serverUnavailable.retry")}
        </Button>
      </div>
    </main>
  );
}
