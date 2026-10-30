import {
  type CreatedPublicLink,
  PUBLIC_TOKEN_HEADER,
  type PublicLinkStatus,
  type PublicTable,
} from "@tablaria/shared";
import { apiRequest } from "@/lib/api-client";
import type { RecordsView } from "@/features/records/records-view";

const path = (tableId: string) => `/tables/${tableId}/public-link`;

export const publicLinksApi = {
  status: (tableId: string) => apiRequest<PublicLinkStatus>(path(tableId)),
  create: (tableId: string) => apiRequest<CreatedPublicLink>(path(tableId), { method: "PUT" }),
  remove: (tableId: string) => apiRequest<void>(path(tableId), { method: "DELETE" }),
  /** The token goes in a header: URLs end up in server logs (ADR-026). */
  read: (token: string, view: Pick<RecordsView, "page" | "pageSize" | "search">) =>
    apiRequest<PublicTable>(
      `/public/table?${new URLSearchParams({
        page: String(view.page),
        pageSize: String(view.pageSize),
        search: view.search,
      })}`,
      { headers: { [PUBLIC_TOKEN_HEADER]: token }, skipRefresh: true },
    ),
};

/** The public page's address: the token after the #, which browsers never send. */
export function publicLinkUrl(token: string): string {
  return `${window.location.origin}/p#${token}`;
}
