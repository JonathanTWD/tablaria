import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function SiteFooter() {
  const { t } = useTranslation("landing");
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-landing items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <span>{t("footer", { year: new Date().getFullYear() })}</span>
        <Link to="/login" className="rounded-md hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          {t("nav.login")}
        </Link>
      </div>
    </footer>
  );
}
