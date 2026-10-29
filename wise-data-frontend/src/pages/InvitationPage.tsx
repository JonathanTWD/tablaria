import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { useLogout, useSession } from "@/features/auth/session";
import { sharingApi } from "@/features/sharing/api";
import { useAcceptInvitation } from "@/features/sharing/queries";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Where invitation emails lead. The route requires a session: without one the
 * guard sends the user to log in and back here, token included.
 */
export default function InvitationPage() {
  const { t, i18n } = useTranslation("app");
  const navigate = useNavigate();
  const token = useSearchParams()[0].get("token");
  const { data: user } = useSession();
  const logout = useLogout();
  const accept = useAcceptInvitation();
  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => sharingApi.preview(token ?? ""),
    enabled: Boolean(token),
    retry: false,
  });

  const homeLink = (
    <Link to="/app" className={cn(buttonVariants({ variant: "outline" }), "h-9 w-fit")}>
      {t("invitation.goHome")}
    </Link>
  );
  const status = preview.error instanceof ApiError ? preview.error.status : null;

  let content;
  if (!token) {
    content = (
      <>
        <AuthHeading title={t("invitation.notFoundTitle")} description={t("invitation.missingToken")} />
        {homeLink}
      </>
    );
  } else if (preview.isPending) {
    content = (
      <div aria-busy="true" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-40" />
      </div>
    );
  } else if (status === 403) {
    content = (
      <>
        <AuthHeading
          title={t("invitation.wrongAccountTitle")}
          description={t("invitation.wrongAccountDescription", { email: user?.email })}
        />
        <div className="flex flex-wrap gap-3">
          <Button className="h-9" onClick={() => logout.mutate()} disabled={logout.isPending}>
            {t("invitation.logout")}
          </Button>
          {homeLink}
        </div>
      </>
    );
  } else if (status === 404) {
    content = (
      <>
        <AuthHeading
          title={t("invitation.notFoundTitle")}
          description={t("invitation.notFoundDescription")}
        />
        {homeLink}
      </>
    );
  } else if (preview.isError) {
    content = (
      <>
        <FormAlert>
          {t("invitation.error")} {apiErrorMessage(preview.error)}
        </FormAlert>
        {homeLink}
      </>
    );
  } else {
    const invitation = preview.data;
    const { target } = invitation;
    const inviter = invitation.invitedBy ?? t("invitation.someone");
    const onAccept = () =>
      accept.mutate(token, {
        onSuccess: () => {
          if (target.type === "table") {
            toast.success(t("invitation.accepted", { table: target.name }));
            void navigate(`/app/tables/${target.id}`, { replace: true });
          } else {
            toast.success(t("invitation.organization.accepted", { name: target.name }));
            void navigate("/app", { replace: true });
          }
        },
      });
    content = (
      <>
        {target.type === "table" ? (
          <AuthHeading
            title={t("invitation.heading")}
            description={t("invitation.summary", {
              inviter,
              action: t(`invitation.actions.${invitation.role === "VIEWER" ? "VIEWER" : "EDITOR"}`),
              table: target.name,
            })}
          />
        ) : (
          <AuthHeading
            title={t("invitation.organization.heading")}
            description={t("invitation.organization.summary", {
              inviter,
              name: target.name,
              role: t(`invitation.organization.roles.${invitation.role}`),
            })}
          />
        )}
        <p className="text-sm text-muted-foreground">
          {t("invitation.expires", {
            time: formatRelativeTime(invitation.expiresAt, i18n.language),
          })}
        </p>
        {accept.error && <FormAlert>{apiErrorMessage(accept.error)}</FormAlert>}
        <div className="flex flex-wrap gap-3">
          <Button
            className="h-9"
            onClick={onAccept}
            disabled={accept.isPending}
            aria-busy={accept.isPending}
          >
            {accept.isPending && (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            )}
            {target.type === "table"
              ? t("invitation.accept")
              : t("invitation.organization.accept")}
          </Button>
          <Link to="/app" className={cn(buttonVariants({ variant: "ghost" }), "h-9")}>
            {t("invitation.decline")}
          </Link>
        </div>
      </>
    );
  }

  return (
    // Each state's AuthHeading sets the document title.
    <div className="flex flex-col gap-6">{content}</div>
  );
}
