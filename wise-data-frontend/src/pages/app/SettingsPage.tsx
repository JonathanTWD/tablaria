import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLogout, useSession } from "@/features/auth/session";
import { useTheme } from "@/features/theme/theme-context";
import { THEME_OPTIONS } from "@/features/theme/theme-options";
import { cn } from "@/lib/utils";

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t border-border py-8 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10"
    >
      <div>
        <h2 id={id} className="font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation(["app", "common"]);
  const { data: user } = useSession();
  const { theme, setTheme } = useTheme();
  const logout = useLogout();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const memberSince = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(
    new Date(user.createdAt),
  );

  return (
    <>
      <title>{`${t("settings.title")} | WiseData`}</title>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>

      <SettingsSection id="settings-account" title={t("settings.account.title")}>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("settings.account.email")}</dt>
            <dd className="mt-1 font-medium break-all">{user.email}</dd>
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

      <SettingsSection
        id="settings-session"
        title={t("settings.session.title")}
        description={t("settings.session.description")}
      >
        <Button
          variant="outline"
          className="h-10 px-4"
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSuccess: () => navigate("/", { replace: true }),
              onError: () => toast.error(t("logoutError")),
            })
          }
        >
          <LogOut aria-hidden="true" />
          {t("settings.session.logout")}
        </Button>
      </SettingsSection>
    </>
  );
}
