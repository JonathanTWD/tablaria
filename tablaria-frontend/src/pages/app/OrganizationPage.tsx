import { useQuery } from "@tanstack/react-query";
import { hasRole } from "@tablaria/shared";
import { ArrowLeft, Building2, Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { SettingsSection } from "@/components/SettingsSection";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MembersSection } from "@/features/organizations/MembersSection";
import { OrganizationDangerZone } from "@/features/organizations/OrganizationDangerZone";
import { OrganizationInviteForm } from "@/features/organizations/OrganizationInviteForm";
import { RenameOrganizationForm } from "@/features/organizations/RenameOrganizationForm";
import { organizationQuery } from "@/features/organizations/queries";
import { useSpace } from "@/features/organizations/space-context";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

/** Members, invitations and settings of one organization. */
export default function OrganizationPage() {
  const { t } = useTranslation("organizations");
  const { organizationId = "" } = useParams();
  const organization = useQuery(organizationQuery(organizationId));
  const { setSpaceId } = useSpace();
  const navigate = useNavigate();

  const backLink = (
    <Link
      to="/app"
      className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {t("page.back")}
    </Link>
  );

  if (organization.isPending) {
    return (
      <div aria-busy="true" className="mx-auto w-full max-w-4xl">
        {backLink}
        <Skeleton className="mt-4 h-8 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-48" />
        <Skeleton className="mt-10 h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (organization.isError) {
    // A malformed id (400) is as unknown as a missing or foreign organization (404).
    const notFound =
      organization.error instanceof ApiError &&
      (organization.error.status === 404 || organization.error.status === 400);
    const title = notFound ? t("page.notFoundTitle") : t("page.loadError");
    return (
      <div className="mx-auto w-full max-w-4xl">
        <title>{`${title} | Tablaria`}</title>
        {backLink}
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
          {notFound ? t("page.notFoundDescription") : apiErrorMessage(organization.error)}
        </p>
        {notFound ? (
          <Link to="/app" className={cn(buttonVariants(), "mt-6 h-9")}>
            {t("page.back")}
          </Link>
        ) : (
          <Button className="mt-6 h-9" onClick={() => void organization.refetch()}>
            {t("page.retry")}
          </Button>
        )}
      </div>
    );
  }

  const { data } = organization;
  // The personal space has nothing to manage: it's the user's alone.
  if (data.personal) {
    return <Navigate to="/app" replace />;
  }
  const manages = hasRole(data.role, "ADMIN");
  const openTables = () => {
    setSpaceId(data.id);
    void navigate("/app");
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <title>{`${data.name} | Tablaria`}</title>
      {backLink}
      <div className="mt-4 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight break-words">
            <Building2 aria-hidden="true" className="size-6 shrink-0 text-primary" />
            {data.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("page.meta", {
              role: t(`roles.${data.role}`),
              members: t("page.members", { count: data.memberCount }),
              tables: t("page.tables", { count: data.tableCount }),
            })}
          </p>
        </div>
        <Button variant="outline" className="h-9" onClick={openTables}>
          <Table2 aria-hidden="true" />
          {t("page.openTables")}
        </Button>
      </div>

      {manages && (
        <SettingsSection
          id="organization-invite"
          title={t("invite.title")}
          description={t("invite.description")}
        >
          <OrganizationInviteForm organizationId={data.id} />
        </SettingsSection>
      )}

      <SettingsSection id="organization-members" title={t("members.title")}>
        <MembersSection organization={data} />
      </SettingsSection>

      {manages && (
        <SettingsSection id="organization-name" title={t("rename.section")}>
          <RenameOrganizationForm organization={data} />
        </SettingsSection>
      )}

      <SettingsSection id="organization-danger" title={t("danger.title")}>
        <OrganizationDangerZone organization={data} />
      </SettingsSection>
    </div>
  );
}
