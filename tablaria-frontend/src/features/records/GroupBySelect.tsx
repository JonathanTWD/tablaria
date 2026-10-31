import type { TableColumn } from "@tablaria/shared";
import { Group } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "none";

/** Picks the column whose values group the records, or none. */
export function GroupBySelect({
  columns,
  value,
  onChange,
}: {
  /** The columns the records can be grouped by. */
  columns: TableColumn[];
  value: string | undefined;
  onChange: (columnId: string | undefined) => void;
}) {
  const { t } = useTranslation("records");
  const id = useId();
  const items = {
    [NONE]: t("group.none"),
    ...Object.fromEntries(
      columns.map((column) => [column.id, t("group.by", { column: column.name })]),
    ),
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {t("group.label")}
      </label>
      <Select
        items={items}
        value={value ?? NONE}
        onValueChange={(next) => onChange(next && next !== NONE ? next : undefined)}
      >
        <SelectTrigger id={id} className="h-9 w-auto min-w-40">
          <Group aria-hidden="true" className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("group.none")}</SelectItem>
          {columns.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {t("group.by", { column: column.name })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
