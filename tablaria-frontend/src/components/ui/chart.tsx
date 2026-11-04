import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui's chart wrapper, trimmed to what Tablaria uses: a responsive
 * container styled with the theme, and a tooltip that matches the popovers.
 * Colors come from the theme tokens (`--chart-1`…), so dark mode just works.
 */

export function ChartContainer({
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  return (
    <div
      data-slot="chart"
      className={cn(
        "flex aspect-video justify-center text-xs",
        "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/60 [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden [&_.recharts-layer]:outline-hidden",
        className,
      )}
      {...props}
    >
      <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
    </div>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

interface TooltipEntry {
  value?: unknown;
  payload?: { label?: string; display?: string };
}

/**
 * The tooltip of a chart whose rows carry their own `label` and `display`
 * text, already formatted as the table shows them.
 */
export function ChartTooltipContent({
  active,
  payload,
  title,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  /** What the value measures, e.g. "Suma de Salario". */
  title: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) {
    return null;
  }
  return (
    <div className="grid min-w-32 gap-1 rounded-lg border border-border/50 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{row.label}</p>
      <p className="flex items-center justify-between gap-4 text-muted-foreground">
        {title}
        <span className="font-medium text-foreground tabular-nums">{row.display}</span>
      </p>
    </div>
  );
}
