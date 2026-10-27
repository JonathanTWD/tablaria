import { zodResolver } from "@hookform/resolvers/zod";
import { TABLE_TEMPLATE_IDS, tableNameSchema } from "@wisedata/shared";
import { FilePlus2, Monitor, Package, Tags, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactElement } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import { useCreateTable } from "./queries";

const STARTING_POINTS = ["blank", ...TABLE_TEMPLATE_IDS] as const;
type StartingPoint = (typeof STARTING_POINTS)[number];

const STARTING_POINT_ICONS: Record<StartingPoint, LucideIcon> = {
  blank: FilePlus2,
  "basic-inventory": Package,
  "product-catalog": Tags,
  assets: Monitor,
};

const createTableFormSchema = z.object({
  startingPoint: z.enum(STARTING_POINTS),
  name: tableNameSchema,
});

type CreateTableForm = z.infer<typeof createTableFormSchema>;

/** Opens from `trigger`; on success it goes to the new table. */
export function CreateTableDialog({
  trigger,
  onCreated,
}: {
  trigger: ReactElement;
  onCreated?: () => void;
}) {
  const { t } = useTranslation(["tables", "common"]);
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent
        closeLabel={t("common:close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.description")}</DialogDescription>
        </DialogHeader>
        <CreateTableForm
          onCreated={() => {
            setOpen(false);
            onCreated?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CreateTableForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation("tables");
  const ids = useId();
  const navigate = useNavigate();
  const create = useCreateTable();
  const form = useForm<CreateTableForm>({
    resolver: zodResolver(createTableFormSchema),
    mode: "onTouched",
    defaultValues: { startingPoint: "basic-inventory", name: t("templates.basic-inventory.name") },
  });
  const startingPoint = useWatch({ control: form.control, name: "startingPoint" });

  const templateNames = TABLE_TEMPLATE_IDS.map((id) => t(`templates.${id}.name`));

  // Suggests the template's name, unless the user already wrote their own.
  const suggestName = (point: StartingPoint) => {
    const name = form.getValues("name").trim();
    if (name === "" || templateNames.includes(name)) {
      form.setValue("name", point === "blank" ? "" : t(`templates.${point}.name`));
    }
  };

  const onSubmit = form.handleSubmit(({ startingPoint: point, name }) =>
    create.mutate(
      { name, templateId: point === "blank" ? undefined : point },
      {
        onSuccess: (table) => {
          toast.success(t("create.created", { name: table.name }));
          // Navigate first: onCreated may close the mobile menu that holds this dialog.
          void navigate(`/app/tables/${table.id}`);
          onCreated();
        },
      },
    ),
  );

  const formError =
    create.error &&
    (create.error instanceof ApiError && create.error.status === 422
      ? t("create.limit")
      : apiErrorMessage(create.error));

  return (
    <form noValidate onSubmit={onSubmit}>
      <FieldGroup className="gap-5">
        {formError && <FormAlert>{formError}</FormAlert>}

        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("create.template")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {STARTING_POINTS.map((point) => {
              const Icon = STARTING_POINT_ICONS[point];
              const checked = startingPoint === point;
              return (
                <label
                  key={point}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                    checked && "border-primary bg-primary/5 hover:bg-primary/5",
                  )}
                >
                  <input
                    type="radio"
                    value={point}
                    className="sr-only"
                    {...form.register("startingPoint", { onChange: () => suggestName(point) })}
                  />
                  <Icon
                    aria-hidden="true"
                    className={cn("mt-0.5 size-4 shrink-0", checked ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{t(`templates.${point}.name`)}</span>
                    <span className="text-xs leading-5 text-muted-foreground">
                      {t(`templates.${point}.description`)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <FormField
          id={`${ids}-name`}
          label={t("create.name")}
          error={form.formState.errors.name && t("validation.tableName")}
        >
          <Input autoComplete="off" className="h-9" {...form.register("name")} />
        </FormField>
      </FieldGroup>

      <DialogFooter className="mt-6">
        <DialogClose render={<Button type="button" variant="outline" className="h-9" />}>
          {t("cancel")}
        </DialogClose>
        <SubmitButton pending={create.isPending} className="h-9 w-full text-sm sm:w-auto">
          {t("create.submit")}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
