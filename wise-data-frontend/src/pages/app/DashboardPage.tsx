import { useQuery } from "@tanstack/react-query";
import type { TableSummary } from "@wisedata/shared";
import { Plus, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/session";
import { CreateTableDialog } from "@/features/tables/CreateTableDialog";
import { tablesQuery } from "@/features/tables/queries";
import { apiErrorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/format";

export default function DashboardPage() {
  const { t } = useTranslation(["app", "tables"]);
  const { data: user } = useSession();
  const tables = useQuery(tablesQuery);
  const name = user?.email.split("@")[0] ?? "";

  const createButton = (
    <Button className="h-9">
      <Plus aria-hidden="true" />
      {t("tables:create.open")}
    </Button>
  );

  return (
    <>
      <title>{`${t("dashboard.title")} | WiseData`}</title>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("dashboard.greeting", { name })}
        </h1>
        {tables.data && tables.data.length > 0 && <CreateTableDialog trigger={createButton} />}
      </div>

      {tables.isPending && (
        <div aria-busy="true" className="mt-8">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="mt-10 h-6 w-40" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        </div>
      )}

      {tables.isError && (
        <div className="mt-8 flex flex-col items-start gap-4">
          <FormAlert>
            {t("dashboard.loadError")} {apiErrorMessage(tables.error)}
          </FormAlert>
          <Button variant="outline" className="h-9" onClick={() => void tables.refetch()}>
            {t("dashboard.retry")}
          </Button>
        </div>
      )}

      {tables.data?.length === 0 && (
        <section
          aria-labelledby="tables-empty"
          className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 sm:px-10"
        >
          <Table2 aria-hidden="true" className="size-8 text-primary" strokeWidth={1.5} />
          <h2 id="tables-empty" className="mt-4 text-lg font-semibold tracking-tight">
            {t("dashboard.emptyTitle")}
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
            {t("dashboard.emptyDescription")}
          </p>
          <div className="mt-6">
            <CreateTableDialog trigger={createButton} />
          </div>
        </section>
      )}

      {tables.data && tables.data.length > 0 && <TablesOverview tables={tables.data} />}
    </>
  );
}

function TablesOverview({ tables }: { tables: TableSummary[] }) {
  const { t, i18n } = useTranslation(["app", "tables"]);
  const recordCount = tables.reduce((total, table) => total + table.recordCount, 0);
  const metrics = [
    { label: t("dashboard.metrics.tables"), value: tables.length.toLocaleString(i18n.language) },
    { label: t("dashboard.metrics.records"), value: recordCount.toLocaleString(i18n.language) },
    // The list comes most recently edited first.
    {
      label: t("dashboard.metrics.lastEdit"),
      value: formatRelativeTime(tables[0].updatedAt, i18n.language),
    },
  ];

  return (
    <>
      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        {metrics.map(({ label, value }, index) => (
          <div
            key={label}
            className={index === 2 ? "col-span-2 bg-card px-5 py-4 sm:col-span-1" : "bg-card px-5 py-4"}
          >
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums first-letter:uppercase">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="tables-title" className="mt-10">
        <h2 id="tables-title" className="text-lg font-semibold tracking-tight">
          {t("dashboard.tablesTitle")}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tables.map((table) => (
            <li key={table.id}>
              <Link
                to={`/app/tables/${table.id}`}
                className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Table2 aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{table.name}</span>
                </span>
                {table.description && (
                  <span className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {table.description}
                  </span>
                )}
                <span className="mt-auto pt-3 text-xs text-muted-foreground">
                  {[
                    t("tables:count.columns", { count: table.columnCount }),
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
    </>
  );
}
