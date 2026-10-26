import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button-variants";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh flex-col bg-background px-4 py-6 sm:px-8">
      <title>{`${t("notFound.title")} | ${t("brand")}`}</title>
      <Link to="/" aria-label={t("homeLink")} className="w-fit rounded-md">
        <Logo />
      </Link>
      <div className="m-auto max-w-md">
        <p className="text-6xl font-semibold tracking-tight text-primary tabular-nums">
          404
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {t("notFound.title")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("notFound.description")}</p>
        <Link to="/" className={cn(buttonVariants(), "mt-6 h-10 px-4")}>
          {t("notFound.action")}
        </Link>
      </div>
    </main>
  );
}
