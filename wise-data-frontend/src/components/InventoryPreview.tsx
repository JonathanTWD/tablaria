import { Hash, Euro, Tag, Type, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface PreviewRow {
  product: string;
  category: string;
  stock: number;
  price: number;
}

const COLUMNS: {
  key: keyof PreviewRow;
  icon: LucideIcon;
  numeric?: boolean;
  optional?: boolean;
}[] = [
  { key: "product", icon: Type },
  // Dropped when the container is narrow (auth side panel) instead of scrolling sideways.
  { key: "category", icon: Tag, optional: true },
  { key: "stock", icon: Hash, numeric: true },
  { key: "price", icon: Euro, numeric: true },
];

/**
 * Static sample of an inventory table with typed columns. It shows what the
 * product does instead of describing it; meant for the dark brand surfaces.
 */
export function InventoryPreview({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const rows: readonly PreviewRow[] = t("preview.rows", { returnObjects: true });
  const price = new Intl.NumberFormat(i18n.language, {
    style: "currency",
    currency: t("preview.currency"),
  });
  const quantity = new Intl.NumberFormat(i18n.language);

  return (
    <div
      className={cn(
        "@container overflow-x-auto rounded-xl border border-white/12 bg-white/[0.04] text-sm text-brand-navy-foreground",
        className,
      )}
    >
      <table className="w-full border-collapse">
        <caption className="sr-only">{t("preview.caption")}</caption>
        <thead>
          <tr className="border-b border-white/12 text-left text-xs font-medium text-white/60">
            {COLUMNS.map(({ key, icon: Icon, numeric, optional }) => (
              <th
                key={key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 font-medium whitespace-nowrap",
                  numeric && "text-right",
                  optional && "hidden @md:table-cell",
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5",
                    numeric && "flex-row-reverse",
                  )}
                >
                  <Icon aria-hidden="true" className="size-3.5 text-white/45" />
                  {t(`preview.columns.${key}`)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.product}
              className="border-b border-white/8 last:border-b-0"
            >
              <th scope="row" className="px-4 py-3 text-left font-medium">
                {row.product}
              </th>
              <td className="hidden px-4 py-3 @md:table-cell">
                <span className="whitespace-nowrap rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/85">
                  {row.category}
                </span>
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {row.stock === 0 ? (
                  <span className="text-[#ffb4bd]">{t("preview.outOfStock")}</span>
                ) : (
                  quantity.format(row.stock)
                )}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {price.format(row.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
