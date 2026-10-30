import type { TableDetail } from "@wisedata/shared";
import { useOutletContext } from "react-router";
import { ActivityList } from "@/features/activity/ActivityList";

export default function ActivityPage() {
  const table = useOutletContext<TableDetail>();
  return <ActivityList table={table} />;
}
