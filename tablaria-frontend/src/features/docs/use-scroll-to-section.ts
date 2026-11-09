import { useEffect } from "react";

/** The router doesn't restore scroll: each page opens at its top, or at the section in the URL. */
export function useScrollToSection(key: string, hash: string) {
  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) {
      target.scrollIntoView();
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [key, hash]);
}
