import { Navigate, Outlet, useLocation, useSearchParams } from "react-router";
import { FullPageLoader } from "@/components/FullPageLoader";
import { safeRedirect } from "@/features/auth/redirect";
import { useSession } from "@/features/auth/session";
import { ServerUnavailable } from "@/pages/ServerUnavailable";

/** UX only: the API enforces authorization on every request. */
export function RequireAuth() {
  const { data: user, isPending, isError, refetch } = useSession();
  const location = useLocation();

  if (isPending) {
    return <FullPageLoader waitingForApi />;
  }
  if (isError) {
    return <ServerUnavailable onRetry={() => void refetch()} />;
  }
  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(from)}`} replace />;
  }
  return <Outlet />;
}

/** Login and sign-up screens send an existing session straight to the app. */
export function GuestOnly() {
  const { data: user, isPending } = useSession();
  const [searchParams] = useSearchParams();

  if (isPending) {
    return <FullPageLoader waitingForApi />;
  }
  if (user) {
    return <Navigate to={safeRedirect(searchParams.get("redirect"))} replace />;
  }
  return <Outlet />;
}
