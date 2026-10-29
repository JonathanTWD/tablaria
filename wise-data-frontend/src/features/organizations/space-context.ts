import type { OrganizationSummary } from "@wisedata/shared";
import { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";

interface SpaceContextValue {
  /** Personal space first, then the organizations by name; undefined while loading. */
  spaces: OrganizationSummary[] | undefined;
  /** The space the sidebar and the dashboard show; undefined while loading. */
  space: OrganizationSummary | undefined;
  /** Set when the list failed to load. */
  error: Error | null;
  retry: () => void;
  setSpaceId: (organizationId: string) => void;
}

export const SpaceContext = createContext<SpaceContextValue | null>(null);

export function useSpace(): SpaceContextValue {
  const value = useContext(SpaceContext);
  if (!value) {
    throw new Error("useSpace needs a SpaceProvider");
  }
  return value;
}

const SPACE_STORAGE_KEY = "wisedata:space";

/** The last space chosen in this browser, like the sidebar state. */
export function readSavedSpace(): string | null {
  try {
    return localStorage.getItem(SPACE_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, site data disabled): start in the personal space.
    return null;
  }
}

export function saveSpace(organizationId: string) {
  try {
    localStorage.setItem(SPACE_STORAGE_KEY, organizationId);
  } catch {
    // Storage blocked: the choice only lasts until the page reloads.
  }
}

/** The personal space is named from the user's point of view, not "Personal". */
export function useSpaceName(): (space: OrganizationSummary) => string {
  const { t } = useTranslation("organizations");
  return (space) => (space.personal ? t("personal") : space.name);
}
