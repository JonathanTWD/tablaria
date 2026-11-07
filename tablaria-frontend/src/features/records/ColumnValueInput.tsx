import type { TableColumn } from "@tablaria/shared";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RelationPicker } from "@/features/relations/RelationPicker";
import { fromDraft, toDraft } from "./cell-draft";

/**
 * The field for one column's value in a form, as a text draft (see
 * cell-draft): a picker for relations, a list for yes/no and options, and a
 * text, number or date input for the rest.
 */
export function ColumnValueInput({
  ref,
  id,
  column,
  value,
  onChange,
  onBlur,
  invalid = false,
  describedBy,
  linked = {},
}: {
  /** Lets a form focus the field, e.g. on an error. */
  ref?: Ref<HTMLInputElement & HTMLButtonElement>;
  id: string;
  column: TableColumn;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
  /** Labels of the records relation cells link to (ADR-022). */
  linked?: Record<string, string>;
}) {
  const { t } = useTranslation("records");

  if (column.type === "relation") {
    return (
      <RelationPicker
        id={id}
        column={column}
        value={fromDraft(column, value)}
        linked={linked}
        label={column.name}
        onChange={(next) => onChange(toDraft(next))}
        className="h-9 border border-input"
      />
    );
  }

  if (column.type === "boolean" || column.type === "select") {
    const options: Record<string, string> =
      column.type === "boolean"
        ? { true: t("filters.yes"), false: t("filters.no") }
        : Object.fromEntries(column.options.choices.map((choice) => [choice.label, choice.label]));
    const items = { "": t("dialog.empty"), ...options };
    return (
      <Select items={items} value={value} onValueChange={(next) => onChange(next ?? "")}>
        <SelectTrigger
          ref={ref}
          id={id}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onBlur={onBlur}
          className="h-9 w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([itemValue, text]) => (
            <SelectItem key={itemValue} value={itemValue}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      ref={ref}
      id={id}
      type={column.type === "date" ? "date" : "text"}
      inputMode={column.type === "text" || column.type === "date" ? undefined : "decimal"}
      autoComplete="off"
      aria-invalid={invalid}
      aria-describedby={describedBy}
      className="h-9"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
    />
  );
}
