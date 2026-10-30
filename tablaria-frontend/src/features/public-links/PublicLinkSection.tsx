import { useQuery } from "@tanstack/react-query";
import type { CreatedPublicLink } from "@tablaria/shared";
import { Copy, Link2, Link2Off } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/session";
import { apiErrorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/format";
import { publicLinkUrl } from "./api";
import { publicLinkQuery, useCreatePublicLink, useRemovePublicLink } from "./queries";

/** A read-only link anyone can open, for the table's admins (ADR-026). */
export function PublicLinkSection({ tableId }: { tableId: string }) {
  const { t, i18n } = useTranslation("tables");
  const ids = useId();
  const { data: user } = useSession();
  const status = useQuery({ ...publicLinkQuery(tableId), enabled: !user?.demoExpiresAt });
  const create = useCreatePublicLink(tableId);
  const remove = useRemovePublicLink(tableId);
  // Only its hash is stored: the link can be shown once, right after it's made.
  const [created, setCreated] = useState<CreatedPublicLink | null>(null);
  const error = create.error ?? remove.error;

  const onCreate = () =>
    create.mutate(undefined, {
      onSuccess: (link) => {
        setCreated(link);
        remove.reset();
      },
    });
  const onRemove = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        setCreated(null);
        create.reset();
        toast.success(t("share.publicLink.removed"));
      },
    });
  const onCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share.publicLink.copied"));
    } catch {
      toast.error(t("share.publicLink.copyError"));
    }
  };

  return (
    <section aria-labelledby={`${ids}-title`} className="flex flex-col gap-3 border-t border-border pt-5">
      <div>
        <h3 id={`${ids}-title`} className="text-sm font-medium">
          {t("share.publicLink.title")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("share.publicLink.description")}</p>
      </div>

      {user?.demoExpiresAt ? (
        <p className="text-sm text-muted-foreground">{t("share.publicLink.demo")}</p>
      ) : status.isPending ? (
        <Skeleton className="h-9 w-40" />
      ) : status.isError ? (
        <FormAlert>{apiErrorMessage(status.error)}</FormAlert>
      ) : (
        <>
          {error && <FormAlert>{apiErrorMessage(error)}</FormAlert>}
          {created ? (
            <Field>
              <FieldLabel htmlFor={`${ids}-url`}>{t("share.publicLink.url")}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id={`${ids}-url`}
                  readOnly
                  value={publicLinkUrl(created.token)}
                  aria-describedby={`${ids}-once`}
                  className="h-9 font-mono text-xs"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  type="button"
                  className="h-9 shrink-0"
                  onClick={() => void onCopy(publicLinkUrl(created.token))}
                >
                  <Copy aria-hidden="true" />
                  {t("share.publicLink.copy")}
                </Button>
              </div>
              <FieldDescription id={`${ids}-once`}>{t("share.publicLink.shownOnce")}</FieldDescription>
            </Field>
          ) : (
            status.data.enabled &&
            status.data.createdAt && (
              <p className="text-sm">
                {t("share.publicLink.active", {
                  time: formatRelativeTime(status.data.createdAt, i18n.language),
                })}
              </p>
            )
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={status.data.enabled ? "outline" : "default"}
              className="h-9"
              disabled={create.isPending}
              aria-busy={create.isPending}
              onClick={onCreate}
            >
              <Link2 aria-hidden="true" />
              {status.data.enabled ? t("share.publicLink.regenerate") : t("share.publicLink.create")}
            </Button>
            {status.data.enabled && (
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={remove.isPending}
                aria-busy={remove.isPending}
                onClick={onRemove}
              >
                <Link2Off aria-hidden="true" />
                {t("share.publicLink.remove")}
              </Button>
            )}
          </div>
          {status.data.enabled && !created && (
            <p className="text-xs text-muted-foreground">{t("share.publicLink.regenerateHint")}</p>
          )}
        </>
      )}
    </section>
  );
}
