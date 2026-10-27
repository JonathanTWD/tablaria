import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

const ROWS = ["types", "search", "tables", "access"] as const;

export function Comparison() {
  const { t } = useTranslation("landing");

  return (
    <section aria-labelledby="comparativa-title" className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <h2
          id="comparativa-title"
          className="max-w-2xl text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-5xl"
        >
          {t("comparison.title")}
        </h2>

        {/* Narrow screens get a list: restyling table elements as blocks drops their semantics. */}
        <ul className="mt-10 divide-y divide-border border-y border-border md:hidden">
          {ROWS.map((row) => (
            <li key={row} className="space-y-3 py-6">
              <h3 className="font-semibold">{t(`comparison.rows.${row}.aspect`)}</h3>
              <p className="flex gap-2.5 text-muted-foreground">
                <X aria-hidden="true" className="mt-1 size-4 shrink-0" />
                <span>
                  <span className="block text-xs font-medium">{t("comparison.spreadsheet")}</span>
                  {t(`comparison.rows.${row}.spreadsheet`)}
                </span>
              </p>
              <p className="flex gap-2.5">
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                <span>
                  <span className="block text-xs font-medium text-primary">
                    {t("comparison.wisedata")}
                  </span>
                  {t(`comparison.rows.${row}.wisedata`)}
                </span>
              </p>
            </li>
          ))}
        </ul>

        <table className="mt-12 hidden w-full border-collapse text-left md:table">
          <caption className="sr-only">{t("comparison.caption")}</caption>
          <thead>
            <tr className="border-b border-foreground/15 text-sm text-muted-foreground">
              <th scope="col" className="w-1/4 py-3 pr-6 font-medium">
                {t("comparison.aspect")}
              </th>
              <th scope="col" className="py-3 pr-6 font-medium">
                {t("comparison.spreadsheet")}
              </th>
              <th scope="col" className="py-3 font-semibold text-foreground">
                {t("comparison.wisedata")}
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row} className="border-b border-border align-top">
                <th scope="row" className="py-5 pr-6 font-semibold">
                  {t(`comparison.rows.${row}.aspect`)}
                </th>
                <td className="py-5 pr-6 text-muted-foreground">
                  <span className="flex gap-2.5">
                    <X aria-hidden="true" className="mt-1 size-4 shrink-0" />
                    {t(`comparison.rows.${row}.spreadsheet`)}
                  </span>
                </td>
                <td className="py-5">
                  <span className="flex gap-2.5">
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                    {t(`comparison.rows.${row}.wisedata`)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
