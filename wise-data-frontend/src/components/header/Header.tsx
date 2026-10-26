import { Atom } from "lucide-react";
import { Link } from "react-router";

const Header = () => {
  return (
    <header className="absolute inset-x-0 top-0 z-10 px-3 pt-3 sm:px-6 sm:pt-5 lg:px-12">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-14 max-w-7xl items-center justify-between rounded-2xl border border-white/15 bg-[#10106d]/40 px-4 shadow-lg shadow-black/20 backdrop-blur-md sm:h-[60px] sm:px-5"
      >
        <Link
          to="/"
          aria-label="WiseData home"
          className="flex items-center gap-2 text-lg font-medium tracking-tight text-white transition-opacity hover:opacity-80"
        >
          <Atom aria-hidden="true" className="size-7 stroke-[1.8]" />
          <span>WiseData</span>
        </Link>

        <div className="flex items-center gap-3 text-xs font-medium text-white/60 sm:gap-8 sm:text-sm">
          <a className="transition-colors hover:text-white" href="#features">
            Features
          </a>
          <a className="transition-colors hover:text-white" href="#about">
            About
          </a>
          <a
            href="#signup"
            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-white/85 sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Sign up
          </a>
        </div>
      </nav>
    </header>
  );
};

export default Header;
