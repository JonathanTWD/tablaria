import {
  hasRole,
  type ImportCheck,
  type ImportInput,
  MAX_COLUMNS_PER_TABLE,
  MAX_IMPORT_ROWS,
  type TableDetail,
} from "@wisedata/shared";
import { FileUp, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/error-message";
import { matchColumns } from "./column-matching";
import { decodeText, parseCsv } from "./csv";
import { useCheckImport, useRunImport } from "./queries";

/** Above this the file can't fit the API's request limit for imports. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_CHARS = 2_000_000;
/** Select value for a file column that isn't imported (select values can't be null). */
const SKIP = "skip";

interface ImportDialogProps {
  table: TableDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Imports the rows of a CSV file into the table: choose, match columns, review (ADR-021). */
export function ImportDialog({ table, open, onOpenChange }: ImportDialogProps) {
  const { t } = useTranslation(["records", "common"]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("common:close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{t("import.title", { name: table.name })}</DialogTitle>
          <DialogDescription>{t("import.description")}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every import starts from scratch. */}
        {open && <ImportWizard table={table} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

interface LoadedFile {
  name: string;
  rows: string[][];
}

function ImportWizard({ table, onDone }: { table: TableDetail; onDone: () => void }) {
  const { t, i18n } = useTranslation("records");
  const maxRows = MAX_IMPORT_ROWS.toLocaleString(i18n.language);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<(string | null)[]>([]);
  const [addMissingChoices, setAddMissingChoices] = useState(false);
  const check = useCheckImport(table.id);
  const run = useRunImport(table.id);

  const width = file ? fileWidth(file.rows) : 0;
  const headers = file
    ? Array.from({ length: width }, (_, index) =>
        hasHeader && file.rows[0][index]?.trim()
          ? file.rows[0][index].trim()
          : t("import.columnNumber", { number: index + 1 }),
      )
    : [];
  const dataRows = (file?.rows ?? [])
    .slice(hasHeader ? 1 : 0)
    .map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));

  const body = (addChoices = addMissingChoices): ImportInput => ({
    columns: mapping,
    rows: dataRows,
    addMissingChoices: addChoices,
  });
  // The rows go to the API as JSON; a file over its limit is refused here first.
  const tooLarge = JSON.stringify(dataRows).length > MAX_BODY_CHARS;

  const startOver = () => {
    setFile(null);
    setMapping([]);
    setAddMissingChoices(false);
    check.reset();
    run.reset();
  };

  const onFile = async (selected: File | undefined) => {
    setFileError(null);
    if (!selected) {
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFileError(t("import.errors.tooLarge", { max: maxRows }));
      return;
    }
    let rows: string[][];
    try {
      rows = parseCsv(decodeText(await selected.arrayBuffer()));
    } catch {
      setFileError(t("import.errors.unreadable"));
      return;
    }
    if (rows.length < (hasHeader ? 2 : 1)) {
      setFileError(t("import.errors.empty"));
      return;
    }
    if (rows.length - (hasHeader ? 1 : 0) > MAX_IMPORT_ROWS) {
      setFileError(t("import.errors.tooManyRows", { max: maxRows }));
      return;
    }
    setFile({ name: selected.name, rows });
    setMapping(initialMapping(rows, hasHeader, table));
  };

  if (!file) {
    return (
      <FileStep
        hasHeader={hasHeader}
        onHasHeaderChange={setHasHeader}
        error={fileError}
        onFile={(selected) => void onFile(selected)}
      />
    );
  }

  if (!check.data) {
    return (
      <MappingStep
        table={table}
        fileName={file.name}
        headers={headers}
        samples={headers.map((_, index) => dataRows.find((row) => row[index]?.trim())?.[index] ?? "")}
        rowCount={dataRows.length}
        mapping={mapping}
        onMappingChange={setMapping}
        hasHeader={hasHeader}
        onHasHeaderChange={(value) => {
          setHasHeader(value);
          setMapping(initialMapping(file.rows, value, table));
        }}
        error={
          tooLarge
            ? t("import.errors.tooLarge", { max: maxRows })
            : check.error && importErrorMessage(t, check.error, maxRows)
        }
        pending={check.isPending}
        onBack={startOver}
        onCheck={() => check.mutate(body())}
        canCheck={!tooLarge && mapping.some((id) => id !== null)}
      />
    );
  }

  return (
    <ReviewStep
      table={table}
      result={check.data}
      firstRowNumber={hasHeader ? 2 : 1}
      addMissingChoices={addMissingChoices}
      onAddMissingChoicesChange={(value) => {
        setAddMissingChoices(value);
        check.mutate(body(value));
      }}
      checking={check.isPending}
      error={run.error && importErrorMessage(t, run.error, maxRows)}
      pending={run.isPending}
      onBack={() => check.reset()}
      onImport={() =>
        run.mutate(body(), {
          onSuccess: (result) => {
            toast.success(t("import.done", { count: result.imported }));
            onDone();
          },
        })
      }
    />
  );
}

/** Columns of the file: its longest row, up to what a table can hold. */
function fileWidth(rows: string[][]): number {
  return Math.min(Math.max(0, ...rows.map((row) => row.length)), MAX_COLUMNS_PER_TABLE);
}

/** One entry per file column: matched by header name, or skipped without a header. */
function initialMapping(rows: string[][], hasHeader: boolean, table: TableDetail): (string | null)[] {
  const matched = hasHeader ? matchColumns(rows[0], table.columns) : [];
  return Array.from({ length: fileWidth(rows) }, (_, index) => matched[index] ?? null);
}

function FileStep({
  hasHeader,
  onHasHeaderChange,
  error,
  onFile,
}: {
  hasHeader: boolean;
  onHasHeaderChange: (value: boolean) => void;
  error: string | null;
  onFile: (file: File | undefined) => void;
}) {
  const { t, i18n } = useTranslation("records");
  const ids = useId();
  return (
    <div className="flex flex-col gap-5">
      <StepLabel step={1} />
      {error && <FormAlert>{error}</FormAlert>}
      <Field>
        <FieldLabel htmlFor={`${ids}-file`}>{t("import.file")}</FieldLabel>
        <input
          id={`${ids}-file`}
          type="file"
          accept=".csv,text/csv"
          aria-describedby={`${ids}-file-hint`}
          onChange={(event) => onFile(event.target.files?.[0])}
          className="block w-full rounded-lg border border-dashed border-border p-4 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
        />
        <FieldDescription id={`${ids}-file-hint`}>
          {t("import.fileHint", { max: MAX_IMPORT_ROWS.toLocaleString(i18n.language) })}
        </FieldDescription>
      </Field>
      <HeaderSwitch checked={hasHeader} onCheckedChange={onHasHeaderChange} />
    </div>
  );
}

function HeaderSwitch({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  const { t } = useTranslation("records");
  const ids = useId();
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={`${ids}-header`}>{t("import.hasHeader")}</FieldLabel>
      </FieldContent>
      <Switch id={`${ids}-header`} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  );
}

function MappingStep({
  table,
  fileName,
  headers,
  samples,
  rowCount,
  mapping,
  onMappingChange,
  hasHeader,
  onHasHeaderChange,
  error,
  pending,
  onBack,
  onCheck,
  canCheck,
}: {
  table: TableDetail;
  fileName: string;
  headers: string[];
  samples: string[];
  rowCount: number;
  mapping: (string | null)[];
  onMappingChange: (mapping: (string | null)[]) => void;
  hasHeader: boolean;
  onHasHeaderChange: (value: boolean) => void;
  error: string | null | undefined;
  pending: boolean;
  onBack: () => void;
  onCheck: () => void;
  canCheck: boolean;
}) {
  const { t } = useTranslation("records");
  const items = {
    [SKIP]: t("import.skip"),
    ...Object.fromEntries(table.columns.map((column) => [column.id, column.name])),
  };

  return (
    <div className="flex flex-col gap-5">
      <StepLabel step={2} />
      <p className="text-sm text-muted-foreground">
        {t("import.fileSummary", { name: fileName, count: rowCount })}
      </p>
      <HeaderSwitch checked={hasHeader} onCheckedChange={onHasHeaderChange} />
      {error && <FormAlert>{error}</FormAlert>}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("import.mapping")}</legend>
        <p className="text-xs leading-5 text-muted-foreground">{t("import.mappingHint")}</p>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {headers.map((header, index) => (
            <li key={index} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{header}</span>
                {samples[index] && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {t("import.sample", { value: samples[index] })}
                  </span>
                )}
              </span>
              <Select
                items={items}
                value={mapping[index] ?? SKIP}
                onValueChange={(value) => {
                  const next = [...mapping];
                  next[index] = value && value !== SKIP ? value : null;
                  onMappingChange(next);
                }}
              >
                <SelectTrigger aria-label={t("import.columnFor", { name: header })} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SKIP}>{t("import.skip")}</SelectItem>
                  {table.columns.map((column) => (
                    <SelectItem
                      key={column.id}
                      value={column.id}
                      // Each table column takes one column of the file.
                      disabled={mapping.some((id, other) => id === column.id && other !== index)}
                    >
                      {column.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </fieldset>
      <DialogFooter>
        <Button type="button" variant="outline" className="h-9" onClick={onBack}>
          {t("import.otherFile")}
        </Button>
        <Button className="h-9" disabled={!canCheck || pending} aria-busy={pending} onClick={onCheck}>
          {pending && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
          {t("import.check")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function ReviewStep({
  table,
  result,
  firstRowNumber,
  addMissingChoices,
  onAddMissingChoicesChange,
  checking,
  error,
  pending,
  onBack,
  onImport,
}: {
  table: TableDetail;
  result: ImportCheck;
  firstRowNumber: number;
  addMissingChoices: boolean;
  onAddMissingChoicesChange: (value: boolean) => void;
  checking: boolean;
  error: string | null | undefined;
  pending: boolean;
  onBack: () => void;
  onImport: () => void;
}) {
  const { t } = useTranslation("records");
  const ids = useId();
  const columnsById = new Map(table.columns.map((column) => [column.id, column]));
  const canAddChoices = hasRole(table.role, "ADMIN");
  const ready = result.errorCount === 0 && result.validRows > 0;

  return (
    <div className="flex flex-col gap-5">
      <StepLabel step={3} />
      <p role="status" className="text-sm font-medium">
        {ready
          ? t("import.ready", { count: result.validRows })
          : t("import.summary", { valid: result.validRows, count: result.rows, errors: result.errorCount })}
      </p>

      {result.missingChoices.length > 0 && (
        <section aria-labelledby={`${ids}-choices`} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <h3 id={`${ids}-choices`} className="text-sm font-medium">
            {t("import.missingChoices")}
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {result.missingChoices.map(({ columnId, values }) => (
              <li key={columnId}>
                <span className="font-medium">{columnsById.get(columnId)?.name}:</span> {values.join(", ")}
              </li>
            ))}
          </ul>
          {canAddChoices ? (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={`${ids}-add`}>{t("import.addChoices")}</FieldLabel>
              </FieldContent>
              <Switch
                id={`${ids}-add`}
                checked={addMissingChoices}
                disabled={checking}
                onCheckedChange={onAddMissingChoicesChange}
              />
            </Field>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">{t("import.choicesAdminOnly")}</p>
          )}
        </section>
      )}

      {result.errors.length > 0 && (
        <section aria-labelledby={`${ids}-errors`}>
          <h3 id={`${ids}-errors`} className="text-sm font-medium">
            {t("import.errorsTitle")}
          </h3>
          <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-3 text-sm">
            {result.errors.map((cellError) => {
              const column = columnsById.get(cellError.columnId);
              return (
                <li key={`${cellError.row}-${cellError.columnId}`}>
                  {t(cellError.value ? "import.errorLine" : "import.errorLineEmpty", {
                    row: cellError.row + firstRowNumber - 1,
                    column: column?.name ?? "",
                    value: cellError.value,
                  })}{" "}
                  <span className="text-muted-foreground">
                    {cellError.reason === "invalid"
                      ? t(`import.reasons.invalid.${column?.type ?? "text"}`)
                      : t(`import.reasons.${cellError.reason}`)}
                  </span>
                </li>
              );
            })}
          </ul>
          {result.errorCount > result.errors.length && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("import.moreErrors", { count: result.errorCount - result.errors.length })}
            </p>
          )}
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("import.fixHint")}</p>
        </section>
      )}

      {error && <FormAlert>{error}</FormAlert>}
      <DialogFooter>
        <Button type="button" variant="outline" className="h-9" onClick={onBack}>
          {t("import.back")}
        </Button>
        <Button className="h-9" disabled={!ready || pending || checking} aria-busy={pending} onClick={onImport}>
          {pending ? (
            <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <FileUp aria-hidden="true" />
          )}
          {t("import.submit", { count: result.validRows })}
        </Button>
      </DialogFooter>
    </div>
  );
}

/**
 * Takes the focus when its step appears: the control that had it (the file
 * input, a button) is gone, and screen readers hear which step this is.
 */
function StepLabel({ step }: { step: number }) {
  const { t } = useTranslation("records");
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    // The first step keeps the dialog's own initial focus.
    if (step > 1) {
      ref.current?.focus();
    }
  }, [step]);
  return (
    <p ref={ref} tabIndex={-1} className="text-xs font-medium text-muted-foreground outline-none">
      {t("import.step", { step, total: 3 })}
    </p>
  );
}

type Translate = ReturnType<typeof useTranslation<"records">>["t"];

/** The API's reasons to refuse, in the dialog's words. */
function importErrorMessage(t: Translate, error: Error, maxRows: string): string {
  if (error instanceof ApiError && error.status === 413) {
    return t("import.errors.tooLarge", { max: maxRows });
  }
  if (error instanceof ApiError && error.status === 422) {
    return t("import.errors.rejected");
  }
  if (error instanceof ApiError && error.status === 403) {
    return t("import.errors.forbidden");
  }
  return apiErrorMessage(error);
}
