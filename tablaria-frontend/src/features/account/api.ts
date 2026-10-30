import type {
  ChangePasswordInput,
  DeleteAccountInput,
  MessageResponse,
} from "@tablaria/shared";
import { apiDownload, apiRequest } from "@/lib/api-client";

export const accountApi = {
  changePassword: (body: ChangePasswordInput) =>
    apiRequest<MessageResponse>("/account/password", { method: "POST", body }),
  logoutEverywhere: () => apiRequest<void>("/account/logout-everywhere", { method: "POST" }),
  exportData: () => apiDownload("/account/export", "tablaria.json"),
  remove: (body: DeleteAccountInput) =>
    apiRequest<void>("/account/delete", { method: "POST", body }),
};
