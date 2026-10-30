import { useInfiniteQuery } from "@tanstack/react-query";
import type { ActivityAction, ActivityEvent, TableDetail } from "@tablaria/shared";
import {
  ArrowDownUp,
  Columns3,
  FilePlus2,
  FileUp,
  type LucideIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { activityQuery } from "./queries";

const ICONS: Record<ActivityAction, LucideIcon> = {
  "record.created": FilePlus2,
  "record.updated": Pencil,
  "record.deleted": Trash2,
  "records.imported": FileUp,
  "column.created": Columns3,
  "column.updated": Columns3,
  "column.deleted": Trash2,
  "stock.moved": ArrowDownUp,
};

/** Who changed what in the table, newest first, grouped by day. */
export function ActivityList({ table }: { table: TableDetail }) {
  const { t, i18n } = useTranslation("tables");
  const ids = useId();
  const activity = useInfiniteQuery(activityQuery(table.id));
  const dayFormat = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (activity.isPending) {
    return (
      <div className="mt-6 flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }
  if (activity.isError) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        {t("activity.loadError")}{" "}
        <Button variant="link" className="h-auto p-0" onClick={() => void activity.refetch()}>
          {t("activity.retry")}
        </Button>
      </p>
    );
  }

  const events = activity.data.pages.flatMap((page) => page.data);
  if (events.length === 0) {
    return (
      <section className="mt-6 rounded-lg border border-dashed border-border px-6 py-10 text-center">
        <h2 className="text-sm font-medium">{t("activity.emptyTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("activity.emptyDescription")}</p>
      </section>
    );
  }

  const days = new Map<string, ActivityEvent[]>();
  for (const event of events) {
    const day = dayFormat.format(new Date(event.createdAt));
    days.set(day, [...(days.get(day) ?? []), event]);
  }

  return (
    <section aria-labelledby={`${ids}-title`} className="mt-6 flex flex-col gap-6">
      <div>
        <h2 id={`${ids}-title`} className="text-base font-semibold">
          {t("activity.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("activity.description")}</p>
      </div>
      {[...days].map(([day, dayEvents]) => (
        <section key={day} aria-label={day}>
          <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {day}
          </h3>
          <ol className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {dayEvents.map((event) => (
              <ActivityItem key={event.id} event={event} />
            ))}
          </ol>
        </section>
      ))}
      {activity.hasNextPage && (
        <Button
          variant="outline"
          className="h-9 self-center"
          disabled={activity.isFetchingNextPage}
          aria-busy={activity.isFetchingNextPage}
          onClick={() => void activity.fetchNextPage()}
        >
          {t("activity.more")}
        </Button>
      )}
    </section>
  );
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  const { t, i18n } = useTranslation("tables");
  const Icon = ICONS[event.action];
  const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" });
  const number = new Intl.NumberFormat(i18n.language);
  const label = event.label ?? t("activity.unnamed");
  const { details } = event;
  const who = event.mine ? t("activity.you") : (event.by ?? t("activity.someone"));

  const text = (() => {
    switch (event.action) {
      case "record.updated":
        return t("activity.actions.recordUpdated", {
          label,
          columns: new Intl.ListFormat(i18n.language).format(details.columns ?? []),
        });
      case "records.imported":
        return [
          t("activity.actions.imported"),
          [
            details.created ? t("activity.created", { count: details.created }) : null,
            details.updated ? t("activity.updated", { count: details.updated }) : null,
          ]
            .filter(Boolean)
            .join(" · "),
        ]
          .filter(Boolean)
          .join(": ");
      case "column.updated":
        return details.renamedFrom
          ? t("activity.actions.columnRenamed", { from: details.renamedFrom, label })
          : t("activity.actions.columnUpdated", { label });
      case "stock.moved": {
        const kind = details.kind === "out" || details.kind === "count" ? details.kind : "in";
        const delta = details.delta ?? 0;
        return t(`activity.actions.stock.${kind}`, {
          label,
          column: details.column ?? "",
          quantity: number.format(Math.abs(delta)),
          delta: `${delta < 0 ? "−" : "+"}${number.format(Math.abs(delta))}`,
        });
      }
      case "record.created":
        return t("activity.actions.recordCreated", { label });
      case "record.deleted":
        return t("activity.actions.recordDeleted", { label });
      case "column.created":
        return t("activity.actions.columnCreated", { label });
      case "column.deleted":
        return t("activity.actions.columnDeleted", { label });
    }
  })();

  return (
    <li className="flex items-start gap-3 px-3 py-2.5 text-sm">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="break-words">{text}</p>
        <p className="text-xs text-muted-foreground">
          {who} ·{" "}
          <time dateTime={event.createdAt}>{time.format(new Date(event.createdAt))}</time>
        </p>
      </div>
    </li>
  );
}
