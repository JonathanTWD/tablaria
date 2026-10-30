import {
  hasRole,
  TABLE_ROLES,
  type OrganizationDetail,
  type OrganizationMember,
} from "@tablaria/shared";
import { UserMinus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { displayEmail } from "@/features/auth/display-name";
import { useSession } from "@/features/auth/session";
import { ApiError } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format";
import { useRemoveMember, useRevokeOrganizationInvitation, useUpdateMember } from "./queries";
import { useRoleLabels } from "./role-labels";

/** Why the API refused a change to a member, in the page's words. */
function memberErrorKey(error: Error) {
  if (error instanceof ApiError && error.status === 409) {
    return "members.errors.lastOwner" as const;
  }
  if (error instanceof ApiError && error.status === 403) {
    return "members.errors.forbidden" as const;
  }
  return "members.errors.change" as const;
}

/**
 * Members, with role and removal controls for admins; only owners touch other
 * owners or make someone an owner, as the API enforces.
 */
export function MembersSection({ organization }: { organization: OrganizationDetail }) {
  const { t, i18n } = useTranslation("organizations");
  const { data: user } = useSession();
  const updateMember = useUpdateMember(organization.id);
  const removeMember = useRemoveMember(organization.id);
  const revoke = useRevokeOrganizationInvitation(organization.id);
  const roleLabels = useRoleLabels();
  const manages = hasRole(organization.role, "ADMIN");
  const isOwner = organization.role === "OWNER";
  const roleOptions = isOwner ? TABLE_ROLES : TABLE_ROLES.filter((role) => role !== "OWNER");
  const onError = (error: Error) => toast.error(t(memberErrorKey(error)));

  // Admins manage everyone but owners; owners manage everyone. Nobody changes their own row here.
  const canManage = (member: OrganizationMember) =>
    manages && member.userId !== user?.id && (isOwner || member.role !== "OWNER");

  return (
    <div className="flex flex-col gap-6">
      <ul aria-label={t("members.title")} className="flex flex-col gap-1">
        {organization.members.map((member) => (
          <li key={member.userId} className="flex min-h-10 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">
              {member.userId === user?.id ? (
                <>
                  {displayEmail(user)}
                  <span className="ml-2 text-xs text-muted-foreground">({t("members.you")})</span>
                </>
              ) : (
                member.email
              )}
            </span>
            {canManage(member) ? (
              <>
                <Select
                  items={roleLabels}
                  value={member.role}
                  onValueChange={(role) =>
                    role &&
                    role !== member.role &&
                    updateMember.mutate({ userId: member.userId, role }, { onError })
                  }
                >
                  <SelectTrigger
                    aria-label={t("members.roleOf", { email: member.email })}
                    size="sm"
                    className="h-8 w-36"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleLabels[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("members.remove", { email: member.email })}
                  onClick={() =>
                    removeMember.mutate(member.userId, {
                      onSuccess: () =>
                        toast.success(t("members.removed", { email: member.email })),
                      onError,
                    })
                  }
                >
                  <UserMinus aria-hidden="true" />
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">{roleLabels[member.role]}</span>
            )}
          </li>
        ))}
      </ul>

      {organization.invitations.length > 0 && (
        <section aria-labelledby={`${organization.id}-invitations`}>
          <h3 id={`${organization.id}-invitations`} className="text-sm font-medium">
            {t("members.pending")}
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {organization.invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{invitation.email}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("members.pendingDetail", {
                      role: roleLabels[invitation.role],
                      time: formatRelativeTime(invitation.expiresAt, i18n.language),
                    })}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("members.revoke", { email: invitation.email })}
                  onClick={() => revoke.mutate(invitation.id, { onError })}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
