import { useTranslation } from "react-i18next";
import { Link } from "react-router";

const LINK_CLASS = "rounded-md hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

export function SiteFooter() {
  const { t } = useTranslation(["landing", "docs", "legal"]);
  const links = [
    { to: "/ayuda", label: t("docs:link") },
    { to: "/privacidad", label: t("legal:links.privacy") },
    { to: "/aviso-legal", label: t("legal:links.legal") },
    { to: "/cookies", label: t("legal:links.cookies") },
    { to: "/login", label: t("nav.login") },
  ];
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-landing flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>{t("footer", { year: new Date().getFullYear() })}</span>
        <nav aria-label={t("landing:footerNav")}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className={LINK_CLASS}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
