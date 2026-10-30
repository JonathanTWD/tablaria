import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  inviteSchema,
  SHARE_ROLES,
  type InviteInput,
  type TableDetail,
  type TableRole,
} from "@wisedata/shared";
import { Mail, UserMinus, X } from "lucide-react";
import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/session";
import { PublicLinkSection } from "@/features/public-links/PublicLinkSection";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/format";
import {
  tableSharingQuery,
  useInvite,
  useRemoveShare,
  useRevokeInvitation,
  useUpdateShare,
} from "./queries";

interface ShareDialogProps {
  table: TableDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Invite people to one table and manage who has it. Admins only. */
export function ShareDialog({ table, open, onOpenChange }: ShareDialogProps) {
  const { t } = useTranslation(["tables", "common"]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("common:close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>{t("share.title", { name: table.name })}</DialogTitle>
          <DialogDescription>{t("share.description")}</DialogDescription>
        </DialogHeader>
        <InviteForm tableId={table.id} />
        <SharingLists tableId={table.id} />
        <PublicLinkSection tableId={table.id} />
      </DialogContent>
    </Dialog>
  );
}

function useRoleItems(): Record<TableRole, string> {
  const { t } = useTranslation("tables");
  return {
    VIEWER: t("share.roles.VIEWER"),
    EDITOR: t("share.roles.EDITOR"),
    ADMIN: t("share.roles.ADMIN"),
    OWNER: t("share.roles.OWNER"),
  };
}

const INVITE_ERRORS = {
  409: "share.errors.alreadyHasAccess",
  422: "share.errors.limit",
  429: "share.errors.tooMany",
  403: "share.errors.demo",
} as const;

/** The API's reasons to refuse an invitation, worded for this form. */
function inviteErrorKey(error: Error) {
  return error instanceof ApiError && error.status in INVITE_ERRORS
    ? INVITE_ERRORS[error.status as keyof typeof INVITE_ERRORS]
    : null;
}

function InviteForm({ tableId }: { tableId: string }) {
  const { t } = useTranslation("tables");
  const ids = useId();
  const { data: user } = useSession();
  const invite = useInvite(tableId);
  const roleItems = useRoleItems();
  const form = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    mode: "onTouched",
    defaultValues: { email: "", role: "EDITOR" },
  });
  const { errors } = form.formState;

  // The public demo can't send email to anyone; the API refuses it too.
  if (user?.demoExpiresAt) {
    return <FormAlert>{t("share.errors.demo")}</FormAlert>;
  }

  const errorKey = invite.error && inviteErrorKey(invite.error);
  const inviteError = invite.error && (errorKey ? t(errorKey) : apiErrorMessage(invite.error));

  const onSubmit = form.handleSubmit((values) =>
    invite.mutate(values, {
      onSuccess: (invitation) => {
        toast.success(t("share.invited", { email: invitation.email }));
        // Ready for the next person, with the same role.
        form.setValue("email", "", { shouldTouch: false, shouldDirty: false });
      },
    }),
  );

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
      {inviteError && <FormAlert>{inviteError}</FormAlert>}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <FormField
          id={`${ids}-email`}
          label={t("share.email")}
          error={errors.email && t("share.errors.email")}
        >
          <Input
            type="email"
            autoComplete="off"
            placeholder="nombre@empresa.com"
            className="h-9"
            {...form.register("email")}
          />
        </FormField>
        <Field>
          <FieldLabel htmlFor={`${ids}-role`}>{t("share.role")}</FieldLabel>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select
                items={roleItems}
                value={field.value}
                onValueChange={(value) => value && field.onChange(value)}
              >
                <SelectTrigger id={`${ids}-role`} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHARE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleItems[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{t("share.rolesHint")}</p>
      <SubmitButton pending={invite.isPending} className="h-9 w-full text-sm sm:w-fit">
        <Mail aria-hidden="true" />
        {t("share.submit")}
      </SubmitButton>
    </form>
  );
}

function SharingLists({ tableId }: { tableId: string }) {
  const { t, i18n } = useTranslation("tables");
  const sharing = useQuery(tableSharingQuery(tableId));
  const updateShare = useUpdateShare(tableId);
  const removeShare = useRemoveShare(tableId);
  const revoke = useRevokeInvitation(tableId);
  const roleItems = useRoleItems();
  const onError = () => toast.error(t("share.errors.change"));

  if (sharing.isPending) {
    return <Skeleton className="mt-2 h-24 w-full rounded-lg" />;
  }
  if (sharing.isError) {
    return <FormAlert>{apiErrorMessage(sharing.error)}</FormAlert>;
  }
  const { members, invitations } = sharing.data;

  return (
    <div className="mt-2 flex flex-col gap-5 border-t border-border pt-5">
      <section aria-labelledby={`${tableId}-members`}>
        <h3 id={`${tableId}-members`} className="text-sm font-medium">
          {t("share.members")}
        </h3>
        {members.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{t("share.noMembers")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{member.email}</span>
                <Select
                  items={roleItems}
                  value={member.role}
                  onValueChange={(role) =>
                    role &&
                    role !== member.role &&
                    updateShare.mutate({ userId: member.userId, role }, { onError })
                  }
                >
                  <SelectTrigger
                    aria-label={t("share.roleOf", { email: member.email })}
                    size="sm"
                    className="h-8 w-28"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHARE_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {roleItems[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("share.remove", { email: member.email })}
                  onClick={() => removeShare.mutate(member.userId, { onError })}
                >
                  <UserMinus aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {invitations.length > 0 && (
        <section aria-labelledby={`${tableId}-invitations`}>
          <h3 id={`${tableId}-invitations`} className="text-sm font-medium">
            {t("share.pending")}
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{invitation.email}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("share.pendingDetail", {
                      role: roleItems[invitation.role],
                      time: formatRelativeTime(invitation.expiresAt, i18n.language),
                    })}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("share.revoke", { email: invitation.email })}
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
