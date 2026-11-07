import { useQuery } from "@tanstack/react-query";
import { MAX_SAVED_VIEWS_PER_TABLE, SAVED_VIEW_NAME_MAX_LENGTH, type SavedView } from "@tablaria/shared";
import { Bookmark, Check, ChevronDown, Pencil, RefreshCw, Save, Settings2, Trash2 } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { RecordsView } from "@/features/records/records-view";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import {
  sameView,
  savedViewsQuery,
  toSavedQuery,
  useCreateSavedView,
  useDeleteSavedView,
  useUpdateSavedView,
  viewFromSaved,
} from "./queries";

function viewErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 409) {
    return i18n.t("records:views.nameTaken");
  }
  if (error instanceof ApiError && error.status === 422) {
    return i18n.t("records:views.limit", { max: MAX_SAVED_VIEWS_PER_TABLE });
  }
  return apiErrorMessage(error);
}

/**
 * The table's saved views (ADR-041): open one in a click; editors save the
 * current view with a name, and rename, update or delete the saved ones.
 */
export function SavedViewsMenu({
  tableId,
  view,
  canEdit,
  onOpen,
}: {
  tableId: string;
  view: RecordsView;
  canEdit: boolean;
  onOpen: (view: RecordsView) => void;
}) {
  const { t } = useTranslation("records");
  const views = useQuery(savedViewsQuery(tableId));
  const [dialog, setDialog] = useState<"save" | "manage" | null>(null);
  const active = views.data?.find((saved) => sameView(saved.view, view));

  // Viewers with no views to open have nothing to do here.
  if (!canEdit && !views.data?.length) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" className="h-9 max-w-56" />}>
          <Bookmark aria-hidden="true" />
          <span className="truncate">{active ? active.name : t("views.button")}</span>
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("views.title")}</DropdownMenuLabel>
            {views.isPending ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("views.loading")}</p>
            ) : views.isError ? (
              <p className="px-2 py-1.5 text-sm text-destructive">{apiErrorMessage(views.error)}</p>
            ) : views.data.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("views.none")}</p>
            ) : (
              views.data.map((saved) => (
                <DropdownMenuItem key={saved.id} onClick={() => onOpen(viewFromSaved(saved.view))}>
                  <Check
                    aria-hidden="true"
                    className={saved.id === active?.id ? "opacity-100" : "opacity-0"}
                  />
                  <span className="truncate">{saved.name}</span>
                  {saved.id === active?.id && <span className="sr-only">{t("views.current")}</span>}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDialog("save")}>
                <Save aria-hidden="true" />
                {t("views.save")}
              </DropdownMenuItem>
              {Boolean(views.data?.length) && (
                <DropdownMenuItem onClick={() => setDialog("manage")}>
                  <Settings2 aria-hidden="true" />
                  {t("views.manage")}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "save" && (
        <SaveViewDialog tableId={tableId} view={view} onClose={() => setDialog(null)} />
      )}
      {dialog === "manage" && views.data && (
        <ManageViewsDialog
          tableId={tableId}
          views={views.data}
          view={view}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}

/** Names the table's current view and saves it. Rendered only while open. */
function SaveViewDialog({
  tableId,
  view,
  onClose,
}: {
  tableId: string;
  view: RecordsView;
  onClose: () => void;
}) {
  const { t } = useTranslation(["records", "common"]);
  const id = useId();
  const [name, setName] = useState("");
  const [empty, setEmpty] = useState(false);
  const create = useCreateSavedView(tableId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === "") {
      setEmpty(true);
      return;
    }
    create.mutate(
      { name: name.trim(), view: toSavedQuery(view) },
      {
        onSuccess: (saved) => {
          toast.success(t("views.saved", { name: saved.name }));
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("common:close")} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("views.saveTitle")}</DialogTitle>
          <DialogDescription>{t("views.saveDescription")}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {create.error && <FormAlert>{viewErrorMessage(create.error)}</FormAlert>}
          <Field data-invalid={empty}>
            <FieldLabel htmlFor={id}>{t("views.name")}</FieldLabel>
            <Input
              id={id}
              value={name}
              maxLength={SAVED_VIEW_NAME_MAX_LENGTH}
              placeholder={t("views.namePlaceholder")}
              autoComplete="off"
              aria-invalid={empty}
              aria-describedby={empty ? `${id}-error` : undefined}
              className="h-9"
              onChange={(event) => {
                setName(event.target.value);
                setEmpty(false);
              }}
            />
            {empty && <FieldError id={`${id}-error`}>{t("views.nameRequired")}</FieldError>}
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-9" />}>
              {t("cancel")}
            </DialogClose>
            <SubmitButton pending={create.isPending} className="h-9 w-full text-sm sm:w-auto">
              {t("views.saveSubmit")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Rename, update with the current view or delete each saved view. Rendered only while open. */
function ManageViewsDialog({
  tableId,
  views,
  view,
  onClose,
}: {
  tableId: string;
  views: SavedView[];
  view: RecordsView;
  onClose: () => void;
}) {
  const { t } = useTranslation(["records", "common"]);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t("common:close")} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("views.manageTitle")}</DialogTitle>
          <DialogDescription>{t("views.manageDescription")}</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {views.map((saved) => (
            <ManagedView key={saved.id} tableId={tableId} saved={saved} view={view} />
          ))}
        </ul>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" className="h-9" />}>
            {t("common:close")}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManagedView({
  tableId,
  saved,
  view,
}: {
  tableId: string;
  saved: SavedView;
  view: RecordsView;
}) {
  const { t } = useTranslation("records");
  const id = useId();
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [name, setName] = useState(saved.name);
  const update = useUpdateSavedView(tableId);
  const remove = useDeleteSavedView(tableId);
  const error = update.error ?? remove.error;
  const isCurrent = sameView(saved.view, view);

  const rename = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === "" || name.trim() === saved.name) {
      setMode("idle");
      return;
    }
    update.mutate(
      { viewId: saved.id, changes: { name: name.trim() } },
      { onSuccess: () => setMode("idle") },
    );
  };

  return (
    <li className="flex flex-col gap-2 p-3">
      {mode === "rename" ? (
        <form onSubmit={rename} className="flex flex-wrap items-end gap-2">
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor={id}>{t("views.newName")}</FieldLabel>
            <Input
              id={id}
              value={name}
              maxLength={SAVED_VIEW_NAME_MAX_LENGTH}
              autoComplete="off"
              autoFocus
              className="h-9"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Button type="submit" className="h-9" disabled={update.isPending} aria-busy={update.isPending}>
            {t("views.renameSubmit")}
          </Button>
          <Button type="button" variant="ghost" className="h-9" onClick={() => setMode("idle")}>
            {t("cancel")}
          </Button>
        </form>
      ) : mode === "delete" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm">{t("views.deleteConfirm", { name: saved.name })}</p>
          <Button
            variant="destructive"
            className="h-9"
            disabled={remove.isPending}
            aria-busy={remove.isPending}
            onClick={() => remove.mutate(saved.id)}
          >
            {t("views.deleteSubmit")}
          </Button>
          <Button variant="ghost" className="h-9" onClick={() => setMode("idle")}>
            {t("cancel")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <div className="mr-auto min-w-0">
            <p className="truncate text-sm font-medium">{saved.name}</p>
            {saved.createdBy && (
              <p className="text-xs text-muted-foreground">
                {t("views.createdBy", { name: saved.createdBy })}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={t("views.update", { name: saved.name })}
            title={t("views.update", { name: saved.name })}
            disabled={isCurrent || update.isPending}
            onClick={() =>
              update.mutate(
                { viewId: saved.id, changes: { view: toSavedQuery(view) } },
                { onSuccess: () => toast.success(t("views.updated", { name: saved.name })) },
              )
            }
          >
            <RefreshCw aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label={t("views.rename", { name: saved.name })}
            title={t("views.rename", { name: saved.name })}
            onClick={() => setMode("rename")}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-destructive"
            aria-label={t("views.delete", { name: saved.name })}
            title={t("views.delete", { name: saved.name })}
            onClick={() => setMode("delete")}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      )}
      {error && <FormAlert>{viewErrorMessage(error)}</FormAlert>}
    </li>
  );
}
