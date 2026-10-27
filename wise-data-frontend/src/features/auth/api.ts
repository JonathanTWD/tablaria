import type {
  AuthUser,
  EmailOnlyInput,
  LoginInput,
  MessageResponse,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "@wisedata/shared";
import { apiRequest } from "@/lib/api-client";

const publicRequest = { method: "POST", skipRefresh: true } as const;

export const authApi = {
  me: () => apiRequest<AuthUser>("/auth/me"),
  login: (body: LoginInput) =>
    apiRequest<AuthUser>("/auth/login", { ...publicRequest, body }),
  register: (body: RegisterInput) =>
    apiRequest<MessageResponse>("/auth/register", { ...publicRequest, body }),
  verifyEmail: (body: VerifyEmailInput) =>
    apiRequest<AuthUser>("/auth/verify-email", { ...publicRequest, body }),
  resendVerification: (body: EmailOnlyInput) =>
    apiRequest<MessageResponse>("/auth/resend-verification", {
      ...publicRequest,
      body,
    }),
  forgotPassword: (body: EmailOnlyInput) =>
    apiRequest<MessageResponse>("/auth/forgot-password", {
      ...publicRequest,
      body,
    }),
  resetPassword: (body: ResetPasswordInput) =>
    apiRequest<MessageResponse>("/auth/reset-password", {
      ...publicRequest,
      body,
    }),
  logout: () => apiRequest<void>("/auth/logout", publicRequest),
};
