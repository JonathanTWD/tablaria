import type { TableDetail } from "@tablaria/shared";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session";
import { useLeaveTable } from "./queries";

interface LeaveTableDialogProps {
  table: TableDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Leaving a table someone shared: only they can give access back. */
export function LeaveTableDialog({ table, open, onOpenChange }: LeaveTableDialogProps) {
  const { t } = useTranslation("tables");
  const navigate = useNavigate();
  const { data: user } = useSession();
  const leave = useLeaveTable(table.id);

  const confirm = () => {
    if (!user) {
      return;
    }
    leave.mutate(user.id, {
      onSuccess: () => {
        toast.success(t("share.left", { name: table.name }));
        void navigate("/app", { replace: true });
      },
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          leave.reset();
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("share.leaveTitle", { name: table.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("share.leaveDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        {leave.error && <FormAlert>{t("share.errors.leave")}</FormAlert>}
        <AlertDialogFooter>
          <AlertDialogCancel className="h-9">{t("cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            className="h-9"
            disabled={leave.isPending}
            aria-busy={leave.isPending}
            onClick={confirm}
          >
            {leave.isPending && (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            )}
            {t("share.leaveConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
