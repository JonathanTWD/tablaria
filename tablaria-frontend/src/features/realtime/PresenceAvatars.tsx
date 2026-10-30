import type { PresenceViewer } from "@tablaria/shared";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { initials, presenceColor } from "./presence-colors";

const MAX_AVATARS = 4;

/** Other people with this table open, as a stack of colored initials. */
export function PresenceAvatars({ viewers }: { viewers: PresenceViewer[] }) {
  const { t } = useTranslation("tables");
  if (viewers.length === 0) {
    return null;
  }
  const names = viewers.map(({ name }) => name ?? t("presence.guest"));
  const hidden = viewers.length - MAX_AVATARS;

  return (
    <div className="flex items-center">
      <p className="sr-only">{t("presence.label", { names: names.join(", ") })}</p>
      <ul aria-hidden="true" className="flex -space-x-2">
        {viewers.slice(0, MAX_AVATARS).map((viewer, index) => (
          <li key={viewer.userId}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-background",
                      presenceColor(viewer.userId).avatar,
                    )}
                  />
                }
              >
                {initials(names[index])}
              </TooltipTrigger>
              <TooltipContent>
                {viewer.editing
                  ? t("presence.editing", { name: names[index] })
                  : t("presence.viewing", { name: names[index] })}
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
        {hidden > 0 && (
          <li className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-background">
            +{hidden}
          </li>
        )}
      </ul>
    </div>
  );
}
