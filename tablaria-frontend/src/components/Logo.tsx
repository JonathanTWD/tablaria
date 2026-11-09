import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Tablaria's mark: a T made of table cells, the header row in the brand
 * color and one column in the text color, so it follows the theme.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-6 shrink-0", className)}>
      <g className="fill-primary">
        <rect x="2" y="3" width="8.6" height="8" rx="2" />
        <rect x="11.7" y="3" width="8.6" height="8" rx="2" />
        <rect x="21.4" y="3" width="8.6" height="8" rx="2" />
      </g>
      <g className="fill-current">
        <rect x="11.7" y="12.4" width="8.6" height="7.8" rx="2" />
        <rect x="11.7" y="21.6" width="8.6" height="7.8" rx="2" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn("flex items-center gap-2 text-lg font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="group-data-[collapsible=icon]:hidden">{t("brand")}</span>
    </span>
  );
}
