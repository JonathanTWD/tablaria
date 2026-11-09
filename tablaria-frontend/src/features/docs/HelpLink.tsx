import { useTranslation } from "react-i18next";

/**
 * «¿Cómo funciona?», to the guide of the feature at hand. It opens a new tab,
 * so the dialog the user is filling in stays as it was.
 */
export function HelpLink({ to, section }: { to: string; section?: string }) {
  const { t } = useTranslation("docs");
  return (
    <a
      href={`/ayuda/${to}${section ? `#${section}` : ""}`}
      target="_blank"
      rel="noopener"
      className="rounded-sm font-medium text-primary underline underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-ring"
    >
      {t("howItWorks")}
      <span className="sr-only"> ({t("newTab")})</span>
    </a>
  );
}
