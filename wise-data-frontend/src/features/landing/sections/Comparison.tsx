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

        {/* Real table on wide screens; each row stacks into a block on small ones. */}
        <table className="mt-12 w-full border-collapse text-left max-md:block">
          <caption className="sr-only">{t("comparison.caption")}</caption>
          <thead className="max-md:hidden">
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
          <tbody className="max-md:block">
            {ROWS.map((row) => (
              <tr
                key={row}
                className="border-b border-border align-top max-md:grid max-md:gap-3 max-md:py-6"
              >
                <th scope="row" className="py-5 pr-6 font-semibold max-md:p-0">
                  {t(`comparison.rows.${row}.aspect`)}
                </th>
                <td className="py-5 pr-6 text-muted-foreground max-md:p-0">
                  <span className="flex gap-2.5">
                    <X aria-hidden="true" className="mt-1 size-4 shrink-0" />
                    <span>
                      <span className="block text-xs font-medium md:hidden">
                        {t("comparison.spreadsheet")}
                      </span>
                      {t(`comparison.rows.${row}.spreadsheet`)}
                    </span>
                  </span>
                </td>
                <td className="py-5 max-md:p-0">
                  <span className="flex gap-2.5">
                    <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                    <span>
                      <span className="block text-xs font-medium text-primary md:hidden">
                        {t("comparison.wisedata")}
                      </span>
                      {t(`comparison.rows.${row}.wisedata`)}
                    </span>
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
