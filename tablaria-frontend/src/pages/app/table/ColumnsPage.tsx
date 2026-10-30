import type { TableDetail } from "@tablaria/shared";
import { useOutletContext } from "react-router";
import { ColumnList } from "@/features/columns/ColumnList";

export default function ColumnsPage() {
  const table = useOutletContext<TableDetail>();
  return <ColumnList table={table} />;
}
