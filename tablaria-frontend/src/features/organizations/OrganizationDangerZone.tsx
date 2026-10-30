import type { OrganizationDetail } from "@tablaria/shared";
import { LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session";
import { ApiError } from "@/lib/api-client";
import { useLeaveOrDeleteOrganization } from "./queries";

/** Leaving (anyone) and deleting (owners), each behind a confirmation. */
export function OrganizationDangerZone({ organization }: { organization: OrganizationDetail }) {
  const { t } = useTranslation("organizations");
  const navigate = useNavigate();
  const { data: user } = useSession();
  const [action, setAction] = useState<"leave" | "delete" | null>(null);
  const leave = useLeaveOrDeleteOrganization(organization.id, "leave");
  const remove = useLeaveOrDeleteOrganization(organization.id, "delete");
  const mutation = action === "delete" ? remove : leave;

  const close = () => {
    leave.reset();
    remove.reset();
    setAction(null);
  };

  const confirm = () => {
    if (!user || !action) {
      return;
    }
    mutation.mutate(user.id, {
      onSuccess: () => {
        toast.success(
          t(action === "delete" ? "danger.deleted" : "danger.left", { name: organization.name }),
        );
        // The space switches back to the personal one on its own.
        void navigate("/app", { replace: true });
      },
    });
  };

  const error =
    mutation.error &&
    (mutation.error instanceof ApiError && mutation.error.status === 409
      ? t("danger.lastOwner")
      : t("danger.error"));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm leading-6 text-muted-foreground">{t("danger.leaveDescription")}</p>
        <Button variant="outline" className="h-9" onClick={() => setAction("leave")}>
          <LogOut aria-hidden="true" />
          {t("danger.leave")}
        </Button>
      </div>
      {organization.role === "OWNER" && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm leading-6 text-muted-foreground">{t("danger.deleteDescription")}</p>
          <Button variant="destructive" className="h-9" onClick={() => setAction("delete")}>
            <Trash2 aria-hidden="true" />
            {t("danger.delete")}
          </Button>
        </div>
      )}
      {action && (
        <ConfirmDeleteDialog
          title={t(action === "delete" ? "danger.deleteTitle" : "danger.leaveTitle", {
            name: organization.name,
          })}
          description={t(action === "delete" ? "danger.deleteDescription" : "danger.leaveDescription")}
          confirmLabel={t(action === "delete" ? "danger.delete" : "danger.leave")}
          pending={mutation.isPending}
          error={error}
          onConfirm={confirm}
          onOpenChange={(open) => !open && close()}
        />
      )}
    </div>
  );
}
