import { Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/features/auth/session";

export default function DashboardPage() {
  const { t } = useTranslation("app");
  const { data: user } = useSession();
  const name = user?.email.split("@")[0] ?? "";

  return (
    <>
      <title>{`${t("dashboard.title")} | WiseData`}</title>
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("dashboard.greeting", { name })}
      </h1>

      <section
        aria-labelledby="tables-empty"
        className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 sm:px-10"
      >
        <Table2 aria-hidden="true" className="size-8 text-primary" strokeWidth={1.5} />
        <h2 id="tables-empty" className="mt-4 text-lg font-semibold tracking-tight">
          {t("dashboard.emptyTitle")}
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
          {t("dashboard.emptyDescription")}
        </p>
      </section>
    </>
  );
}
