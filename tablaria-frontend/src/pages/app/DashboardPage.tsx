import { useQuery } from "@tanstack/react-query";
import { hasRole, type TableSummary } from "@tablaria/shared";
import { Building2, Plus, Settings, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { displayName } from "@/features/auth/display-name";
import { useSession } from "@/features/auth/session";
import { useSpace, useSpaceName } from "@/features/organizations/space-context";
import { SharedTablesSection } from "@/features/sharing/SharedTablesSection";
import { CreateTableDialog } from "@/features/tables/CreateTableDialog";
import { tablesQuery } from "@/features/tables/queries";
import { upcomingDatesQuery } from "@/features/upcoming-dates/queries";
import { UpcomingDatesCard } from "@/features/upcoming-dates/UpcomingDatesCard";
import { apiErrorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { t } = useTranslation(["app", "tables", "organizations"]);
  const { data: user } = useSession();
  const { space, error: spaceError, retry: retrySpaces } = useSpace();
  const spaceName = useSpaceName();
  const tables = useQuery({ ...tablesQuery(space?.id ?? ""), enabled: Boolean(space) });
  const loadError = spaceError ?? tables.error;
  const loading = !loadError && tables.isPending;
  const ready = tables.isSuccess;
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
          <div className="mt-8">
            <Skeleton className="h-6 w-40" />
            <div className="mt-4 grid gap-3 @xl:grid-cols-2 @5xl:grid-cols-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
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
          {space?.personal && <SharedTablesSection className="mt-10" />}
        </>
      )}

      {ready && tables.data.length > 0 && (
        <TablesOverview
          tables={tables.data}
          personal={space?.personal ?? true}
        />
      )}
    </div>
  );
}

const UPCOMING_ID = "proximamente";
/** Enough to see what's next without pushing anything else down. */
const UPCOMING_ON_HOME = 5;

function TablesOverview({
  tables,
  personal,
}: {
  tables: TableSummary[];
  /** The personal space also lists the tables shared with the user. */
  personal: boolean;
}) {
  const { t, i18n } = useTranslation(["app", "tables", "records"]);
  // Across every table the user can open: what comes soon matters wherever it lives.
  const upcoming = useQuery(upcomingDatesQuery());
  const recordCount = tables.reduce((total, table) => total + table.recordCount, 0);
  const nearest = upcoming.data?.items[0];
  const metrics: { label: string; value: string; detail?: string; href?: string }[] = [
    { label: t("dashboard.metrics.tables"), value: tables.length.toLocaleString(i18n.language) },
    { label: t("dashboard.metrics.records"), value: recordCount.toLocaleString(i18n.language) },
    // The list comes most recently edited first.
    {
      label: t("dashboard.metrics.lastEdit"),
      value: formatRelativeTime(tables[0].updatedAt, i18n.language),
    },
  ];
  if (upcoming.data && nearest) {
    // A count up top, the list beside the tables: the tables stay first (ADR-048).
    metrics.push({
      label: t("dashboard.metrics.upcoming"),
      value: upcoming.data.total.toLocaleString(i18n.language),
      detail: t("dashboard.metrics.nearest", {
        label: nearest.label || t("records:table.untitled"),
        when: new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" }).format(nearest.daysLeft, "day"),
      }),
      href: `#${UPCOMING_ID}`,
    });
  }

  return (
    <>
      <dl
        className={cn(
          "mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border",
          metrics.length === 4 ? "@3xl:grid-cols-4" : "sm:grid-cols-3",
        )}
      >
        {metrics.map(({ label, value, detail, href }, index) => (
          <div
            key={label}
            className={cn(
              "relative bg-card px-5 py-4",
              metrics.length === 3 && index === 2 && "col-span-2 sm:col-span-1",
              href && "transition-colors focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-ring hover:bg-muted/40",
            )}
          >
            <dt className="text-xs font-medium text-muted-foreground">
              {href ? (
                // The whole card is the link's target area; the label names it.
                <a href={href} className="outline-none after:absolute after:inset-0">
                  {label}
                </a>
              ) : (
                label
              )}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums first-letter:uppercase">
              {value}
            </dd>
            {detail && <dd className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</dd>}
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-10 @5xl:grid-cols-[minmax(0,1fr)_22rem] @5xl:items-start">
        <div className="flex min-w-0 flex-col gap-10">
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
        {/* After the tables on phones; beside them on wide screens. */}
        {!upcoming.isPending && (
          <UpcomingDatesCard id={UPCOMING_ID} upcoming={upcoming.data} limit={UPCOMING_ON_HOME} />
        )}
      </div>
    </>
  );
}
