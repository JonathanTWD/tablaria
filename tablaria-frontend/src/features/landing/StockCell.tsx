import { TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface StockCellProps {
  value: number;
  /** When set, values below it are flagged as low and 0 as out of stock. */
  lowStock?: number;
  edited: boolean;
  label: string;
  onChange: (value: number) => void;
}

/** Number cell edited in place: click or Enter to edit, Enter/blur to save, Escape to cancel. */
export function StockCell({ value, lowStock, edited, label, onChange }: StockCellProps) {
  const { t, i18n } = useTranslation("landing");
  const [draft, setDraft] = useState<string | null>(null);
  // Set when editing ends, so focus returns to the cell button instead of being lost.
  const returnFocus = useRef(false);
  const formatted = new Intl.NumberFormat(i18n.language).format(value);

  const commit = (fromKeyboard: boolean) => {
    const next = Number(draft);
    if (draft !== null && draft.trim() !== "" && Number.isInteger(next) && next >= 0) {
      onChange(next);
    }
    returnFocus.current = fromKeyboard;
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        aria-label={label}
        // Focusing the field the user just opened is the expected behaviour.
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Focus moves to the cell button during this keydown; without this the
            // same Enter would "click" that button and reopen the editor.
            event.preventDefault();
            commit(true);
          }
          if (event.key === "Escape") {
            returnFocus.current = true;
            setDraft(null);
          }
        }}
        className="h-8 w-24 rounded-md border border-ring bg-background px-2 text-right tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      />
    );
  }

  const status =
    lowStock === undefined ? null : value === 0 ? "out" : value < lowStock ? "low" : null;

  return (
    <button
      ref={(element) => {
        if (element && returnFocus.current) {
          returnFocus.current = false;
          element.focus();
        }
      }}
      type="button"
      onClick={() => setDraft(String(value))}
      className={cn(
        "inline-flex h-8 items-center justify-end gap-2 rounded-md px-2 tabular-nums transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        edited && "bg-accent text-accent-foreground hover:bg-accent",
      )}
    >
      {/* The action first, then what is visible: the accessible name contains the visible text (WCAG 2.5.3). */}
      <span className="sr-only">{label}: </span>
      {status === "out" ? (
        <span className="font-medium text-destructive">{t("demo.outOfStock")}</span>
      ) : (
        <>
          {status === "low" && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
              <TriangleAlert aria-hidden="true" className="size-3 @md:hidden" />
              {/* Icon only in narrow tables; the text stays available to screen readers. */}
              <span className="sr-only @md:not-sr-only">{t("demo.lowStock")}</span>
            </span>
          )}
          {formatted}
        </>
      )}
    </button>
  );
}
