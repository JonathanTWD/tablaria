import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Logo } from "@/components/Logo";
import { useSession } from "@/features/auth/session";

const primaryLink =
  "whitespace-nowrap rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-5 sm:py-2.5 sm:text-sm";
const quietLink =
  "whitespace-nowrap rounded-md transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

const Header = () => {
  const { t } = useTranslation(["landing", "common"]);
  const { data: user } = useSession();

  return (
    <header className="absolute inset-x-0 top-0 z-10 px-3 pt-3 sm:px-6 sm:pt-5 lg:px-12">
      <nav
        aria-label={t("nav.label")}
        className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 text-white shadow-lg shadow-black/20 backdrop-blur-md sm:h-[60px] sm:px-5"
      >
        <Link
          to="/"
          aria-label={t("common:homeLink")}
          className="rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <Logo className="font-medium [&>svg]:size-6 max-[360px]:text-base" />
        </Link>

        <div className="flex items-center gap-3 text-xs font-medium text-white/70 sm:gap-7 sm:text-sm">
          <a className={`hidden md:inline ${quietLink}`} href="#funciones">
            {t("nav.features")}
          </a>
          <a className={`hidden md:inline ${quietLink}`} href="#sobre">
            {t("nav.about")}
          </a>
          {user ? (
            <Link to="/app" className={primaryLink}>
              {t("nav.openApp")}
            </Link>
          ) : (
            <>
              <Link to="/login" className={quietLink}>
                {t("nav.login")}
              </Link>
              <Link to="/register" className={primaryLink}>
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
