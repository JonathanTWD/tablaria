import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { organizationsQuery } from "./queries";
import { readSavedSpace, saveSpace, SpaceContext } from "./space-context";

/** Which space the app shows: the personal one or an organization (ADR-019). */
export function SpaceProvider({ children }: { children: ReactNode }) {
  const organizations = useQuery(organizationsQuery);
  const [savedId, setSavedId] = useState(readSavedSpace);
  const spaces = organizations.data;
  // A space the user left, or that was deleted, falls back to the personal one.
  const space =
    spaces?.find(({ id }) => id === savedId) ?? spaces?.find(({ personal }) => personal);

  const value = {
    spaces,
    space,
    error: organizations.error,
    retry: () => void organizations.refetch(),
    setSpaceId: (organizationId: string) => {
      setSavedId(organizationId);
      saveSpace(organizationId);
    },
  };
  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}
