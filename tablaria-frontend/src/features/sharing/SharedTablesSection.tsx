import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sharedTablesQuery } from "./queries";

/** Tables other people shared with the user; nothing when there are none. */
export function SharedTablesSection({ className }: { className?: string }) {
  const { t, i18n } = useTranslation(["app", "tables"]);
  const shared = useQuery(sharedTablesQuery);

  if (!shared.data?.length) {
    return null;
  }
  return (
    <section aria-labelledby="shared-title" className={cn("@container/shared", className)}>
      <h2 id="shared-title" className="text-lg font-semibold tracking-tight">
        {t("dashboard.sharedTitle")}
      </h2>
      <ul className="mt-4 grid gap-3 @xl/shared:grid-cols-2 @5xl/shared:grid-cols-3">
        {shared.data.map((table) => (
          <li key={table.id}>
            <Link
              to={`/app/tables/${table.id}`}
              className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex items-center gap-2 font-medium">
                <Users aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="truncate">{table.name}</span>
              </span>
              <span className="mt-1.5 truncate text-sm text-muted-foreground">
                {t("dashboard.sharedBy", {
                  name: table.sharedBy,
                  role: t(`tables:share.roles.${table.role}`),
                })}
              </span>
              <span className="mt-auto pt-3 text-xs text-muted-foreground">
                {[
                  t("tables:count.records", { count: table.recordCount }),
                  t("tables:edited", {
                    time: formatRelativeTime(table.updatedAt, i18n.language),
                  }),
                ].join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
