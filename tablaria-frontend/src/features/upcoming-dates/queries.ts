import { queryOptions } from "@tanstack/react-query";
import type { UpcomingDates } from "@tablaria/shared";
import { todayIso } from "@/features/calendar/calendar-dates";
import { apiRequest } from "@/lib/api-client";

/** Every list of upcoming dates: invalidating it refreshes them all. */
export const upcomingDatesKey = ["upcoming-dates"] as const;

/** Dates coming within their warning, in all the user's tables or in one (ADR-048). */
export function upcomingDatesQuery(tableId?: string) {
  const today = todayIso();
  return queryOptions({
    // Today is part of the key: a tab left open overnight asks again.
    queryKey: [...upcomingDatesKey, today, tableId ?? "all"],
    queryFn: () =>
      apiRequest<UpcomingDates>(
        `/upcoming-dates?${new URLSearchParams({ today, ...(tableId && { tableId }) })}`,
      ),
  });
}
