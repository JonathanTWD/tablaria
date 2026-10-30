import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DEFAULT_PAGE_SIZE } from "@wisedata/shared";
import { Eye, Search } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { Logo } from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCellFormatter } from "@/features/columns/format-value";
import { publicLinksApi } from "@/features/public-links/api";
import { RecordsPagination } from "@/features/records/RecordsPagination";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

const ALIGN_END = new Set(["number", "currency"]);

/** A table shared with a read-only link: no account needed (ADR-026). */
export default function PublicTablePage() {
  const { t } = useTranslation("tables");
  const ids = useId();
  const token = useLocation().hash.slice(1);
  const format = useCellFormatter();
  const [view, setView] = useState({ page: 1, pageSize: DEFAULT_PAGE_SIZE, search: "" });
  const [draft, setDraft] = useState("");
  const table = useQuery({
    queryKey: ["public-table", token, view],
    queryFn: () => publicLinksApi.read(token, view),
    enabled: token !== "",
    placeholderData: keepPreviousData,
    retry: false,
  });

  const notFound = token === "" || (table.error instanceof ApiError && table.error.status === 404);

  return (
    <main className="min-h-dvh bg-background px-4 py-6 sm:px-8">
      {/* Shared data is never listed by search engines. */}
      <meta name="robots" content="noindex" />
      <title>{`${table.data?.name ?? t("publicTable.title")} | WiseData`}</title>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link to="/" aria-label={t("publicTable.home")} className="w-fit rounded-md">
          <Logo />
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          <Eye aria-hidden="true" className="size-3.5" />
          {t("publicTable.readOnly")}
        </span>
      </header>

      <div className="mx-auto mt-8 max-w-6xl">
        {notFound ? (
          <section className="mx-auto max-w-md py-16 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{t("publicTable.notFoundTitle")}</h1>
            <p className="mt-3 text-muted-foreground">{t("publicTable.notFoundDescription")}</p>
            <Link to="/" className={cn(buttonVariants(), "mt-6 h-10 px-4")}>
              {t("publicTable.discover")}
            </Link>
          </section>
        ) : table.isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {apiErrorMessage(table.error)}
          </p>
        ) : !table.data ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{table.data.name}</h1>
            {table.data.description && (
              <p className="mt-2 text-muted-foreground">{table.data.description}</p>
            )}

            <form
              role="search"
              className="mt-6 flex w-full gap-2 sm:w-96"
              onSubmit={(event) => {
                event.preventDefault();
                setView({ ...view, page: 1, search: draft.trim() });
              }}
            >
              <label htmlFor={`${ids}-search`} className="sr-only">
                {t("publicTable.search")}
              </label>
              <div className="relative flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id={`${ids}-search`}
                  type="search"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t("publicTable.searchPlaceholder")}
                  className="h-9 pl-8"
                />
              </div>
              <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-9")}>
                {t("publicTable.searchSubmit")}
              </button>
            </form>

            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <caption className="sr-only">{table.data.name}</caption>
                <thead className="bg-muted/50">
                  <tr>
                    {table.data.columns.map((column) => (
                      <th
                        key={column.id}
                        scope="col"
                        className={cn(
                          "px-3 py-2 text-left font-medium whitespace-nowrap",
                          ALIGN_END.has(column.type) && "text-right",
                        )}
                      >
                        {column.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.data.records.data.map((record) => (
                    <tr key={record.id} className="border-t border-border">
                      {table.data.columns.map((column) => (
                        <td
                          key={column.id}
                          className={cn(
                            "px-3 py-2 whitespace-nowrap",
                            ALIGN_END.has(column.type) && "text-right tabular-nums",
                          )}
                        >
                          {format(column, record.data[column.id])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {table.data.records.meta.total === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {view.search ? t("publicTable.noResults") : t("publicTable.empty")}
                </p>
              )}
            </div>
            {table.data.records.meta.total > 0 && (
              <RecordsPagination
                meta={table.data.records.meta}
                onPageChange={(page) => setView({ ...view, page })}
                onPageSizeChange={(pageSize) => setView({ ...view, page: 1, pageSize })}
              />
            )}
            <p className="mt-8 text-center text-xs text-muted-foreground">
              {t("publicTable.madeWith")}{" "}
              <Link to="/" className="underline underline-offset-4 hover:text-foreground">
                WiseData
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
