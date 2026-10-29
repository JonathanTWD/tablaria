import { useMutation } from "@tanstack/react-query";
import { Download, LogOut, MonitorSmartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingsSection } from "@/components/SettingsSection";
import { Button } from "@/components/ui/button";
import { displayEmail } from "@/features/auth/display-name";
import { accountApi } from "@/features/account/api";
import { ChangePasswordForm } from "@/features/account/ChangePasswordForm";
import { DeleteAccountSection } from "@/features/account/DeleteAccountSection";
import { useEndSession, useLogout, useSession } from "@/features/auth/session";
import { useTheme } from "@/features/theme/theme-context";
import { THEME_OPTIONS } from "@/features/theme/theme-options";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { t, i18n } = useTranslation(["app", "common"]);
  const { data: user } = useSession();
  const { theme, setTheme } = useTheme();
  const logout = useLogout();
  const endSession = useEndSession();
  const logoutEverywhere = useMutation({
    mutationFn: accountApi.logoutEverywhere,
    onSuccess: () => {
      toast.success(t("settings.session.everywhereDone"));
      endSession();
    },
    onError: () => toast.error(t("logoutError")),
  });
  const exportData = useMutation({
    mutationFn: accountApi.exportData,
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  if (!user) {
    return null;
  }
  // The demo has no password, and is deleted with its data on its own.
  const demo = user.demoExpiresAt !== null;

  const memberSince = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(
    new Date(user.createdAt),
  );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <title>{`${t("settings.title")} | WiseData`}</title>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>

      <SettingsSection id="settings-account" title={t("settings.account.title")}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("settings.account.email")}</dt>
            <dd className="mt-1 font-medium break-all">{displayEmail(user)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("settings.account.memberSince")}</dt>
            <dd className="mt-1 font-medium">{memberSince}</dd>
          </div>
        </dl>
      </SettingsSection>

      <SettingsSection
        id="settings-appearance"
        title={t("settings.appearance.title")}
        description={t("settings.appearance.description")}
      >
        <div
          role="group"
          aria-labelledby="settings-appearance"
          className="inline-flex rounded-lg border border-border bg-muted p-1"
        >
          {THEME_OPTIONS.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                theme === value && "bg-background text-foreground shadow-sm",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {t(`common:theme.${value}`)}
            </button>
          ))}
        </div>
      </SettingsSection>

      {!demo && (
        <SettingsSection
          id="settings-password"
          title={t("settings.password.title")}
          description={t("settings.password.description")}
        >
          <ChangePasswordForm />
        </SettingsSection>
      )}

      <SettingsSection
        id="settings-session"
        title={t("settings.session.title")}
        description={t("settings.session.description")}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-10 px-4"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, { onError: () => toast.error(t("logoutError")) })
            }
          >
            <LogOut aria-hidden="true" />
            {t("settings.session.logout")}
          </Button>
          <Button
            variant="outline"
            className="h-10 px-4"
            disabled={logoutEverywhere.isPending}
            aria-busy={logoutEverywhere.isPending}
            onClick={() => logoutEverywhere.mutate()}
          >
            <MonitorSmartphone aria-hidden="true" />
            {t("settings.session.everywhere")}
          </Button>
        </div>
      </SettingsSection>

      {!demo && (
        <>
          <SettingsSection
            id="settings-data"
            title={t("settings.data.title")}
            description={t("settings.data.description")}
          >
            <Button
              variant="outline"
              className="h-10 px-4"
              disabled={exportData.isPending}
              aria-busy={exportData.isPending}
              onClick={() => exportData.mutate()}
            >
              <Download aria-hidden="true" />
              {t("settings.data.export")}
            </Button>
          </SettingsSection>

          <SettingsSection id="settings-delete" title={t("settings.delete.section")}>
            <DeleteAccountSection />
          </SettingsSection>
        </>
      )}
    </div>
  );
}
