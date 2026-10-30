import { useEffect, useRef, type RefObject } from "react";
import { useLocation } from "react-router";

/**
 * Client-side navigation does not move focus, so screen reader users are not
 * told the page changed. Moves focus to the main region after each route change
 * (not on first load, where the browser already starts at the top).
 */
export function useFocusOnNavigate<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  const { pathname } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    ref.current?.focus({ preventScroll: true });
  }, [pathname]);

  return ref;
}
