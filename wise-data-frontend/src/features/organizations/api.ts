import type {
  OrganizationDetail,
  OrganizationInput,
  OrganizationInviteInput,
  OrganizationMember,
  OrganizationSummary,
  PendingInvitation,
  TableRole,
} from "@wisedata/shared";
import { apiRequest } from "@/lib/api-client";

export const organizationsApi = {
  list: () => apiRequest<OrganizationSummary[]>("/organizations"),
  get: (id: string) => apiRequest<OrganizationDetail>(`/organizations/${id}`),
  create: (body: OrganizationInput) =>
    apiRequest<OrganizationDetail>("/organizations", { method: "POST", body }),
  rename: (id: string, body: OrganizationInput) =>
    apiRequest<OrganizationDetail>(`/organizations/${id}`, { method: "PATCH", body }),
  remove: (id: string) => apiRequest<void>(`/organizations/${id}`, { method: "DELETE" }),
  updateMember: (id: string, userId: string, role: TableRole) =>
    apiRequest<OrganizationMember>(`/organizations/${id}/members/${userId}`, {
      method: "PATCH",
      body: { role },
    }),
  removeMember: (id: string, userId: string) =>
    apiRequest<void>(`/organizations/${id}/members/${userId}`, { method: "DELETE" }),
  invite: (id: string, body: OrganizationInviteInput) =>
    apiRequest<PendingInvitation>(`/organizations/${id}/invitations`, { method: "POST", body }),
  revoke: (id: string, invitationId: string) =>
    apiRequest<void>(`/organizations/${id}/invitations/${invitationId}`, { method: "DELETE" }),
};
