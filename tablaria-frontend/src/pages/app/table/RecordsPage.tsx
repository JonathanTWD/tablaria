import type { TableDetail } from "@tablaria/shared";
import { useOutletContext } from "react-router";
import { RecordsTable } from "@/features/records/RecordsTable";

export default function RecordsPage() {
  const table = useOutletContext<TableDetail>();
  return <RecordsTable table={table} />;
}
