import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";
import { Logo } from "@/components/Logo";
import { buttonVariants } from "@/components/ui/button-variants";
import { useSession } from "@/features/auth/session";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { cn } from "@/lib/utils";

const SECTION_LINKS = [
  { href: "#funciones", label: "nav.features" },
  { href: "#asistente", label: "nav.assistant" },
  { href: "#casos", label: "nav.useCases" },
  { href: "#preguntas", label: "nav.faq" },
] as const;

export function SiteHeader() {
  const { t } = useTranslation(["landing", "common"]);
  const { data: user } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <nav
        aria-label={t("nav.label")}
        className="mx-auto flex h-16 max-w-landing items-center gap-2 px-4 sm:px-6"
      >
        <Link
          to="/"
          aria-label={t("common:homeLink")}
          className="mr-4 rounded-md"
          // Already on the landing: back to the top (smoothly, see index.css), dropping any #section.
          onClick={(event) => {
            if (pathname === "/") {
              event.preventDefault();
              void navigate("/", { replace: true });
              window.scrollTo({ top: 0 });
            }
          }}
        >
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {SECTION_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {t(label)}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {user ? (
            <Link to="/app" className={cn(buttonVariants(), "h-9 px-3.5")}>
              {t("nav.openApp")}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className={cn(buttonVariants({ variant: "ghost" }), "h-9 px-3")}
              >
                {t("nav.login")}
              </Link>
              <Link to="/register" className={cn(buttonVariants(), "h-9 px-3.5")}>
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
