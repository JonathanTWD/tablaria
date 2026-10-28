import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayEmail, displayName } from "./display-name";
import { useLogout, useSession } from "./session";

export function UserMenu() {
  const { t } = useTranslation("app");
  const { data: user } = useSession();
  const logout = useLogout();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const signOut = () =>
    logout.mutate(undefined, { onError: () => toast.error(t("logoutError")) });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("userMenu.label")}
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring group-data-[collapsible=icon]:p-0"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/12 text-xs font-semibold text-primary">
            {displayName(user).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
          {displayEmail(user)}
        </span>
        <ChevronsUpDown
          aria-hidden="true"
          className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--anchor-width) min-w-56">
        <DropdownMenuItem onClick={() => navigate("/app/settings")}>
          <Settings aria-hidden="true" />
          {t("userMenu.settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} disabled={logout.isPending}>
          <LogOut aria-hidden="true" />
          {t("userMenu.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
