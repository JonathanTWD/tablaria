import type {
  AcceptedInvitation,
  InvitationPreview,
  InviteInput,
  PendingInvitation,
  ShareRole,
  SharedTableSummary,
  TableShareMember,
  TableSharing,
} from "@wisedata/shared";
import { apiRequest } from "@/lib/api-client";

export const sharingApi = {
  sharedWithMe: () => apiRequest<SharedTableSummary[]>("/tables/shared"),
  get: (tableId: string) => apiRequest<TableSharing>(`/tables/${tableId}/sharing`),
  invite: (tableId: string, body: InviteInput) =>
    apiRequest<PendingInvitation>(`/tables/${tableId}/invitations`, { method: "POST", body }),
  revoke: (tableId: string, invitationId: string) =>
    apiRequest<void>(`/tables/${tableId}/invitations/${invitationId}`, { method: "DELETE" }),
  updateShare: (tableId: string, userId: string, role: ShareRole) =>
    apiRequest<TableShareMember>(`/tables/${tableId}/shares/${userId}`, {
      method: "PATCH",
      body: { role },
    }),
  removeShare: (tableId: string, userId: string) =>
    apiRequest<void>(`/tables/${tableId}/shares/${userId}`, { method: "DELETE" }),
  // The token goes in the body, never in a URL the API could log.
  preview: (token: string) =>
    apiRequest<InvitationPreview>("/invitations/preview", { method: "POST", body: { token } }),
  accept: (token: string) =>
    apiRequest<AcceptedInvitation>("/invitations/accept", { method: "POST", body: { token } }),
};
