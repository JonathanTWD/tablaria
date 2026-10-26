import { Atom } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-lg font-semibold tracking-tight",
        className,
      )}
    >
      <Atom aria-hidden="true" className="size-6 stroke-[1.8]" />
      {t("brand")}
    </span>
  );
}
