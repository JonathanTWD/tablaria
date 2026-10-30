import { useQuery } from "@tanstack/react-query";
import { hasRole, type StockAlerts, type TableSummary } from "@tablaria/shared";
import { Building2, Plus, Settings, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { displayName } from "@/features/auth/display-name";
import { useSession } from "@/features/auth/session";
import { RecordsChart } from "@/features/charts/RecordsChart";
import { useSpace, useSpaceName } from "@/features/organizations/space-context";
import { stockAlertsQuery } from "@/features/stock-alerts/queries";
import { SharedTablesSection } from "@/features/sharing/SharedTablesSection";
import { StockAlertsCard } from "@/features/stock-alerts/StockAlertsCard";
import { CreateTableDialog } from "@/features/tables/CreateTableDialog";
import { tablesQuery } from "@/features/tables/queries";
import { apiErrorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/format";

export default function DashboardPage() {
  const { t } = useTranslation(["app", "tables", "organizations"]);
  const { data: user } = useSession();
  const { space, error: spaceError, retry: retrySpaces } = useSpace();
  const spaceName = useSpaceName();
  const tables = useQuery({ ...tablesQuery(space?.id ?? ""), enabled: Boolean(space) });
  // The overview waits for the alerts too, so their card never pushes the tables down.
  const alerts = useQuery(stockAlertsQuery);
  const loadError = spaceError ?? tables.error;
  const loading = !loadError && (tables.isPending || (tables.isSuccess && alerts.isPending));
  const ready = tables.isSuccess && !alerts.isPending;
  const name = user ? displayName(user) : "";
  const canCreate = space !== undefined && hasRole(space.role, "ADMIN");

  const createButton = (
    <Button className="h-9">
      <Plus aria-hidden="true" />
      {t("tables:create.open")}
    </Button>
  );

  return (
    <div className="@container mx-auto w-full max-w-[100rem]">
      <title>{`${t("dashboard.title")} | Tablaria`}</title>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("dashboard.greeting", { name })}
          </h1>
          {space && !space.personal && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Building2 aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">
                  {t("dashboard.space", {
                    name: spaceName(space),
                    role: t(`organizations:roles.${space.role}`),
                  })}
                </span>
              </span>
              <Link
                to={`/app/organizations/${space.id}`}
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
              >
                <Settings aria-hidden="true" className="size-3.5" />
                {t("dashboard.manageSpace")}
              </Link>
            </p>
          )}
        </div>
        {canCreate && tables.data && tables.data.length > 0 && (
          <CreateTableDialog organizationId={space.id} trigger={createButton} />
        )}
      </div>

      {loading && (
        <div aria-busy="true" className="mt-8">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="mt-8 grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_26rem] @7xl:grid-cols-[minmax(0,1fr)_30rem]">
            <div>
              <Skeleton className="h-6 w-40" />
              <div className="mt-4 grid gap-3 @xl:grid-cols-2 @7xl:grid-cols-3">
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-28 rounded-xl" />
              </div>
            </div>
            <Skeleton className="hidden h-64 rounded-xl @5xl:block" />
          </div>
        </div>
      )}

      {loadError && (
        <div className="mt-8 flex flex-col items-start gap-4">
          <FormAlert>
            {t("dashboard.loadError")} {apiErrorMessage(loadError)}
          </FormAlert>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => (spaceError ? retrySpaces() : void tables.refetch())}
          >
            {t("dashboard.retry")}
          </Button>
        </div>
      )}

      {ready && tables.data.length === 0 && (
        <section
          aria-labelledby="tables-empty"
          className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 sm:px-10"
        >
          <Table2 aria-hidden="true" className="size-8 text-primary" strokeWidth={1.5} />
          <h2 id="tables-empty" className="mt-4 text-lg font-semibold tracking-tight">
            {canCreate ? t("dashboard.emptyTitle") : t("dashboard.emptyOrganizationTitle")}
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
            {canCreate
              ? t("dashboard.emptyDescription")
              : t("dashboard.emptyOrganizationDescription")}
          </p>
          {canCreate && (
            <div className="mt-6">
              <CreateTableDialog organizationId={space.id} trigger={createButton} />
            </div>
          )}
        </section>
      )}

      {/* People with no tables of their own may still have some shared with them. */}
      {ready && tables.data.length === 0 && (
        <>
          <StockAlertsCard alerts={alerts.data} className="mt-8" />
          {space?.personal && <SharedTablesSection className="mt-10" />}
        </>
      )}

      {ready && tables.data.length > 0 && (
        <TablesOverview
          tables={tables.data}
          alerts={alerts.data}
          personal={space?.personal ?? true}
        />
      )}
    </div>
  );
}

function TablesOverview({
  tables,
  alerts,
  personal,
}: {
  tables: TableSummary[];
  /** Undefined when the alerts failed to load. */
  alerts: StockAlerts | undefined;
  /** The personal space also lists the tables shared with the user. */
  personal: boolean;
}) {
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

      {/*
        Wide pages put the alerts and the chart in a side column next to the tables.
        The DOM order (alerts, tables, chart) is also the reading order on narrow pages.
      */}
      <div className="mt-8 grid gap-8 @5xl:grid-cols-[minmax(0,1fr)_26rem] @5xl:grid-rows-[auto_1fr] @7xl:grid-cols-[minmax(0,1fr)_30rem]">
        <StockAlertsCard alerts={alerts} className="@5xl:col-start-2 @5xl:self-start" />

        <div className="flex flex-col gap-10 @5xl:col-start-1 @5xl:row-span-2 @5xl:row-start-1">
          <section aria-labelledby="tables-title" className="@container/tables">
            <h2 id="tables-title" className="text-lg font-semibold tracking-tight">
              {personal ? t("dashboard.tablesTitle") : t("dashboard.organizationTablesTitle")}
            </h2>
            <ul className="mt-4 grid gap-3 @xl/tables:grid-cols-2 @5xl/tables:grid-cols-3">
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
          {personal && <SharedTablesSection />}
        </div>

        <RecordsChart tables={tables} className="@5xl:col-start-2 @5xl:self-start" />
      </div>
    </>
  );
}
