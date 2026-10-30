import type { TableRole } from "@tablaria/shared";
import { useTranslation } from "react-i18next";

/** Role names for selects (Base UI shows the label of the selected value from this map). */
export function useRoleLabels(): Record<TableRole, string> {
  const { t } = useTranslation("organizations");
  return {
    VIEWER: t("roles.VIEWER"),
    EDITOR: t("roles.EDITOR"),
    ADMIN: t("roles.ADMIN"),
    OWNER: t("roles.OWNER"),
  };
}
