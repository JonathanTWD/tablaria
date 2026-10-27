import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function BackToLogin() {
  const { t } = useTranslation("auth");
  return (
    <p className="mt-8 text-sm">
      <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
        {t("backToLogin")}
      </Link>
    </p>
  );
}
