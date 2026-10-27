import type { TableDetail } from "@wisedata/shared";
import { useOutletContext } from "react-router";
import { ColumnList } from "@/features/columns/ColumnList";

export default function ColumnsPage() {
  const table = useOutletContext<TableDetail>();
  return <ColumnList table={table} />;
}
