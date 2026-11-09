import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { FullPageLoader } from "@/components/FullPageLoader";
import { GuestOnly, RequireAuth } from "@/routes/guards";

// Route-level code splitting keeps the WebGL landing out of the app bundle and vice versa.
const Home = lazy(() => import("@/pages/Home"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AuthLayout = lazy(() => import("@/layouts/AuthLayout"));
const AppLayout = lazy(() => import("@/layouts/AppLayout"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const VerifyEmailPage = lazy(() => import("@/pages/auth/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/app/DashboardPage"));
const SettingsPage = lazy(() => import("@/pages/app/SettingsPage"));
const TablePage = lazy(() => import("@/pages/app/TablePage"));
const RecordsPage = lazy(() => import("@/pages/app/table/RecordsPage"));
const ColumnsPage = lazy(() => import("@/pages/app/table/ColumnsPage"));
const ActivityPage = lazy(() => import("@/pages/app/table/ActivityPage"));
// Recharts loads only with this page (ADR-035).
const MetricsPage = lazy(() => import("@/pages/app/table/MetricsPage"));
const LabelsPage = lazy(() => import("@/pages/app/table/LabelsPage"));
const PublicTablePage = lazy(() => import("@/pages/PublicTablePage"));
const DocsPage = lazy(() => import("@/pages/DocsPage"));
const InvitationPage = lazy(() => import("@/pages/InvitationPage"));
const OrganizationPage = lazy(() => import("@/pages/app/OrganizationPage"));

const App = () => {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route index element={<Home />} />

        <Route element={<AuthLayout />}>
          <Route element={<GuestOnly />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          {/* Email links work whether or not this browser already has a session. */}
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          {/* Invitation emails link here; accepting needs the invited account. */}
          <Route element={<RequireAuth />}>
            <Route path="invitations" element={<InvitationPage />} />
          </Route>
        </Route>

        <Route path="app" element={<RequireAuth />}>
          {/* Outside the app's frame: only the labels get printed (ADR-038). */}
          <Route path="tables/:tableId/labels" element={<LabelsPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="tables/:tableId" element={<TablePage />}>
              <Route index element={<RecordsPage />} />
              <Route path="columns" element={<ColumnsPage />} />
              <Route path="metrics" element={<MetricsPage />} />
              <Route path="activity" element={<ActivityPage />} />
            </Route>
            <Route path="organizations/:organizationId" element={<OrganizationPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* A read-only link: no account, the token after the # (ADR-026). */}
        <Route path="p" element={<PublicTablePage />} />

        {/* Public help: readable without an account, and by search engines. */}
        <Route path="ayuda" element={<DocsPage />} />
        <Route path="ayuda/:slug" element={<DocsPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

export default App;
