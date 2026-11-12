import { Building2, Check, ChevronsUpDown, Plus, Settings, User } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";
import { useSpace, useSpaceName } from "./space-context";

/** Top of the sidebar: which space the app shows, and where organizations are created. */
export function SpaceSwitcher({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation("organizations");
  const { spaces, space, error, setSpaceId } = useSpace();
  const spaceName = useSpaceName();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  if (error) {
    return <p className="px-2 py-2 text-xs text-muted-foreground">{t("switcher.loadError")}</p>;
  }
  if (!spaces || !space) {
    return <SidebarMenuSkeleton showIcon className="h-12" />;
  }

  const go = (to: string) => {
    void navigate(to);
    onNavigate();
  };
  const label = t("switcher.label", { name: spaceName(space) });
  const SpaceIcon = space.personal ? User : Building2;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <SidebarMenuButton
            size="lg"
            tooltip={label}
            render={<DropdownMenuTrigger />}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <SpaceIcon aria-hidden="true" className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
              <span className="truncate font-medium">{spaceName(space)}</span>
              <span className="truncate text-xs text-muted-foreground">
                {t(`roles.${space.role}`)}
              </span>
            </span>
            {/* Named by what it shows, plus what it does (WCAG 2.5.3). */}
            <span className="sr-only">, {t("switcher.title")}</span>
            <ChevronsUpDown aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
          </SidebarMenuButton>
          <DropdownMenuContent align="start" className="w-(--anchor-width) min-w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t("switcher.title")}</DropdownMenuLabel>
              {spaces.map((option) => {
                const Icon = option.personal ? User : Building2;
                const current = option.id === space.id;
                return (
                  <DropdownMenuItem
                    key={option.id}
                    aria-current={current ? "true" : undefined}
                    onClick={() => {
                      setSpaceId(option.id);
                      go("/app");
                    }}
                  >
                    <Icon aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{spaceName(option)}</span>
                    {current && <Check aria-hidden="true" className="ml-auto" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {!space.personal && (
              <DropdownMenuItem onClick={() => go(`/app/organizations/${space.id}`)}>
                <Settings aria-hidden="true" />
                {t("switcher.manage")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              {t("switcher.create")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <CreateOrganizationDialog open={creating} onOpenChange={setCreating} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
