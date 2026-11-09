import { ArrowRight, FileSpreadsheet, Link2, Paperclip, Sigma, Trash2, TriangleAlert, Check, PencilLine, Bookmark } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type FeatureKey = "relations" | "realtime" | "metrics" | "qr" | "import" | "calendar" | "batch" | "stock";

/** Heights of the decorative bar chart, in percent. */
const BARS = [72, 46, 88, 30, 58];

function FeatureCard({
  feature,
  className,
  children,
}: {
  feature: FeatureKey;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("landing");
  return (
    <li
      data-reveal
      className={cn("flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6", className)}
    >
      <h3 className="text-lg font-semibold tracking-tight">{t(`features.items.${feature}.title`)}</h3>
      <p className="mt-2 leading-7 text-muted-foreground">{t(`features.items.${feature}.description`)}</p>
      {/* A fragment of the real interface: decorative, the text above carries the meaning. */}
      <div aria-hidden="true" className="mt-6 flex flex-1 flex-col justify-end text-sm">
        {children}
      </div>
    </li>
  );
}

function RelationsExample() {
  const { t } = useTranslation("landing");
  const rows = t("features.items.relations.example.rows", { returnObjects: true });
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 font-mono text-xs">
        <Sigma className="size-3.5 text-primary" />
        {t("features.items.relations.example.formula")}
      </div>
      <table className="w-full text-left">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium">{t("features.items.relations.example.product")}</th>
            <th className="px-3 py-2 font-medium">{t("features.items.relations.example.supplier")}</th>
            <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">
              {t("features.items.relations.example.stock")}
            </th>
            <th className="px-3 py-2 text-right font-medium text-primary">
              {t("features.items.relations.example.value")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([product, supplier, stock, value]) => (
            <tr key={product} className="border-b border-border last:border-b-0">
              <td className="truncate px-3 py-2">{product}</td>
              <td className="px-3 py-2">
                <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
                  <Link2 className="size-3 shrink-0" />
                  {supplier}
                </span>
              </td>
              <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">{stock}</td>
              <td className="px-3 py-2 text-right tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RealtimeExample() {
  const { t } = useTranslation("landing");
  return (
    <div className="space-y-3">
      <div className="flex -space-x-1">
        {[
          ["LM", "bg-violet-500"],
          ["JR", "bg-emerald-600"],
          ["AP", "bg-amber-600"],
        ].map(([initials, color]) => (
          <span
            key={initials}
            className={cn("flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-card", color)}
          >
            {initials}
          </span>
        ))}
      </div>
      <div className="relative w-fit pt-5">
        <span className="absolute top-0 left-0 rounded-t-md bg-violet-500 px-1.5 py-0.5 text-[0.7rem] font-medium text-white">
          {t("features.items.realtime.example.editing")}
        </span>
        <span className="block rounded-md rounded-tl-none px-3 py-1.5 ring-2 ring-violet-500">
          {t("features.items.realtime.example.cell")}
          <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 bg-foreground motion-safe:animate-pulse" />
        </span>
      </div>
      <p className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
        {t("features.items.realtime.example.change")}
      </p>
    </div>
  );
}

function MetricsExample() {
  const { t } = useTranslation("landing");
  const labels = t("features.items.metrics.example.bars", { returnObjects: true });
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{t("features.items.metrics.example.total")}</p>
      <p className="text-xl font-semibold tabular-nums">{t("features.items.metrics.example.amount")}</p>
      <div className="mt-3 flex h-24 items-end gap-2">
        {BARS.map((height, index) => (
          <div key={index} className="flex h-full flex-1 flex-col justify-end">
            <div
              className={cn("w-full rounded-t-sm", index === 2 ? "bg-primary" : "bg-primary/35")}
              style={{ height: `${height}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-[0.65rem] text-muted-foreground">
        {labels.map((label) => (
          <span key={label} className="flex-1 truncate text-center">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A QR code look-alike: the three finder squares and a fixed scatter of dots. */
function QrGlyph() {
  const finders = [
    [0, 0],
    [14, 0],
    [0, 14],
  ];
  const dots = [
    [8, 1], [10, 2], [9, 4], [11, 5], [8, 6], [12, 8], [1, 8], [3, 9], [5, 8], [7, 9],
    [9, 9], [10, 10], [14, 9], [16, 8], [18, 10], [20, 9], [8, 11], [11, 12], [13, 13], [15, 12],
    [17, 14], [19, 13], [9, 15], [11, 16], [10, 18], [8, 19], [12, 19], [14, 17], [16, 16], [18, 18],
    [20, 17], [15, 20], [17, 20], [19, 15], [13, 11], [2, 11], [6, 12], [4, 12],
  ];
  return (
    <svg viewBox="0 0 21 21" className="size-20 shrink-0" shapeRendering="crispEdges">
      {finders.map(([x, y]) => (
        <g key={`${x}-${y}`} fill="currentColor">
          <path d={`M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z`} fillRule="evenodd" />
          <rect x={x + 2} y={y + 2} width="3" height="3" />
        </g>
      ))}
      {dots.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  );
}

function QrExample() {
  const { t } = useTranslation("landing");
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-foreground/25 bg-white p-3 text-neutral-900 dark:bg-neutral-100">
        <div className="text-neutral-900">
          <QrGlyph />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{t("features.items.qr.example.name")}</p>
          <p className="text-xs text-neutral-600">{t("features.items.qr.example.reference")}</p>
        </div>
      </div>
      <p className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
        <Paperclip className="size-3.5" />
        {t("features.items.qr.example.attachment")}
      </p>
    </div>
  );
}

function ImportExample() {
  const { t } = useTranslation("landing");
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
        <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
        {t("features.items.import.example.file")}
        <ArrowRight className="ml-auto size-4 text-muted-foreground" />
      </p>
      <ul className="space-y-1.5 rounded-lg bg-muted/50 px-3 py-2.5 text-xs">
        <li className="flex items-center gap-2">
          <Check className="size-3.5 text-primary" />
          {t("features.items.import.example.columns")}
        </li>
        <li className="flex items-center gap-2 text-muted-foreground">
          <span className="rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">2</span>
          {t("features.items.import.example.duplicates")}
        </li>
        <li className="flex items-center gap-2 font-medium">
          <Check className="size-3.5 text-primary" />
          {t("features.items.import.example.ready")}
        </li>
      </ul>
    </div>
  );
}

function BatchExample() {
  const { t } = useTranslation("landing");
  const views = t("features.items.batch.example.views", { returnObjects: true });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {views.map((view, index) => (
          <span
            key={view}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
              index === 0 ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground",
            )}
          >
            <Bookmark className="size-3" />
            {view}
          </span>
        ))}
      </div>
      <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl bg-foreground p-1.5 text-background shadow-lg">
        <span className="px-2 font-medium">{t("features.items.batch.example.selected")}</span>
        <span className="flex items-center gap-1.5 rounded-lg bg-background/15 px-2.5 py-1">
          <PencilLine className="size-3.5" />
          {t("features.items.batch.example.change")}
        </span>
        <span className="flex items-center gap-1.5 rounded-lg px-2.5 py-1">
          <Trash2 className="size-3.5" />
          {t("features.items.batch.example.delete")}
        </span>
      </div>
    </div>
  );
}

/** Two weeks of a month, starting on Monday the 9th: days with records get a colored mark. */
const CALENDAR_DAYS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const CALENDAR_MARKS: Record<number, string[]> = {
  10: ["bg-blue-500"],
  12: ["bg-amber-500"],
  13: ["bg-green-500", "bg-amber-500"],
  16: ["bg-amber-500"],
  18: ["bg-blue-500"],
  21: ["bg-amber-500"],
};

/** The pending order and the warranty in use, as their select colors show them. */
const EVENT_COLORS = ["bg-amber-500", "bg-green-500"];

function CalendarExample() {
  const { t } = useTranslation("landing");
  const weekdays = t("features.items.calendar.example.weekdays", { returnObjects: true });
  const events = t("features.items.calendar.example.events", { returnObjects: true });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 rounded-xl border border-border p-2 text-center text-xs">
        {weekdays.map((day) => (
          <span key={day} className="py-1 text-muted-foreground">
            {day}
          </span>
        ))}
        {CALENDAR_DAYS.map((day) => (
          <span
            key={day}
            className={cn(
              "flex h-9 flex-col items-center justify-center gap-1 rounded-md tabular-nums",
              day === 13 && "bg-primary/10 ring-1 ring-primary",
            )}
          >
            <span className={cn(day === 9 && "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground")}>
              {day}
            </span>
            <span className="flex h-1 gap-0.5">
              {(CALENDAR_MARKS[day] ?? []).map((color, index) => (
                <span key={index} className={cn("size-1 rounded-full", color)} />
              ))}
            </span>
          </span>
        ))}
      </div>
      {events.map(([name, column], index) => (
        <p key={name} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
          <span className={cn("size-2 shrink-0 rounded-full", EVENT_COLORS[index])} />
          <span className="truncate font-medium">{name}</span>
          <span className="truncate text-muted-foreground">· {column}</span>
        </p>
      ))}
    </div>
  );
}

function StockExample() {
  const { t } = useTranslation("landing");
  const movements = t("features.items.stock.example.movements", { returnObjects: true });
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {movements.map(([quantity, reason]) => (
          <li key={reason} className="flex items-center gap-3 px-3 py-2">
            <span
              className={cn(
                "w-10 font-semibold tabular-nums",
                quantity.startsWith("+") ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
              )}
            >
              {quantity}
            </span>
            <span className="truncate text-muted-foreground">{reason}</span>
          </li>
        ))}
      </ul>
      <p className="flex w-fit items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
        <TriangleAlert className="size-3.5" />
        {t("features.items.stock.example.low")}
      </p>
    </div>
  );
}

export function FeatureGrid() {
  const { t } = useTranslation("landing");

  return (
    <section id="funciones" aria-labelledby="funciones-title" className="scroll-mt-16 border-t border-border">
      <div className="mx-auto max-w-landing px-4 py-20 sm:px-6 sm:py-28">
        <div data-reveal className="max-w-2xl">
          <h2
            id="funciones-title"
            className="text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-5xl 2xl:text-landing-title"
          >
            {t("features.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("features.description")}</p>
        </div>

        <ul className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <FeatureCard feature="relations" className="md:col-span-2 lg:col-span-4">
            <RelationsExample />
          </FeatureCard>
          <FeatureCard feature="realtime" className="lg:col-span-2">
            <RealtimeExample />
          </FeatureCard>
          <FeatureCard feature="metrics" className="lg:col-span-2">
            <MetricsExample />
          </FeatureCard>
          <FeatureCard feature="qr" className="lg:col-span-2">
            <QrExample />
          </FeatureCard>
          <FeatureCard feature="import" className="lg:col-span-2">
            <ImportExample />
          </FeatureCard>
          <FeatureCard feature="calendar" className="lg:col-span-2">
            <CalendarExample />
          </FeatureCard>
          <FeatureCard feature="batch" className="lg:col-span-2">
            <BatchExample />
          </FeatureCard>
          <FeatureCard feature="stock" className="md:col-span-2 lg:col-span-2">
            <StockExample />
          </FeatureCard>
        </ul>
      </div>
    </section>
  );
}
