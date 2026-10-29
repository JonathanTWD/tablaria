import {
  type ColumnDefinitionInput,
  type ColumnType,
  hasRole,
  type ImportCheck,
  type ImportTarget,
  MAX_COLUMNS_PER_TABLE,
  MAX_IMPORT_ROWS,
  TABLE_NAME_MAX_LENGTH,
  type TableColumn,
} from "@wisedata/shared";
import { FileUp, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/FormAlert";
import { FormField } from "@/components/form/FormField";
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
import { Input } from "@/components/ui/input";
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
import { columnForFile, IMPORTABLE_TYPES, type ImportableType, inferType } from "./infer-column";
import { type ImportBody, type ImportDestination, useCheckImport, useRunImport } from "./queries";

/** Above this the file can't fit the API's request limit for imports. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_CHARS = 2_000_000;
/** Select values for the choices that aren't a table column (select values can't be null). */
const SKIP = "skip";
const NEW = "new";

/** What a column of the file becomes. */
type Target =
  | { kind: "skip" }
  | { kind: "existing"; id: string }
  | { kind: "new"; type: ImportableType };

/** How the review names a column of the file: as the table column it fills. */
type TargetInfo = { name: string; type: ColumnType } | null;

interface ImportDialogProps {
  destination: ImportDestination;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After a successful import, e.g. to close the phone menu that opened it. */
  onImported?: () => void;
}

/**
 * Imports the rows of a CSV file into a table, or into a new one: choose the
 * file, decide where each column goes, review (ADR-021).
 */
export function ImportDialog({ destination, open, onOpenChange, onImported }: ImportDialogProps) {
  const { t } = useTranslation(["records", "common"]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("common:close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>
            {destination.kind === "table"
              ? t("import.title", { name: destination.table.name })
              : t("import.newTableTitle")}
          </DialogTitle>
          <DialogDescription>
            {destination.kind === "table" ? t("import.description") : t("import.newTableDescription")}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every import starts from scratch. */}
        {open && (
          <ImportWizard
            destination={destination}
            onDone={() => {
              onOpenChange(false);
              onImported?.();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface LoadedFile {
  name: string;
  rows: string[][];
}

function ImportWizard({ destination, onDone }: { destination: ImportDestination; onDone: () => void }) {
  const { t, i18n } = useTranslation("records");
  const navigate = useNavigate();
  const maxRows = MAX_IMPORT_ROWS.toLocaleString(i18n.language);
  const tableColumns = destination.kind === "table" ? destination.table.columns : [];
  // Columns and choices change the table's structure: admins only (the API checks too).
  const canChangeColumns = destination.kind === "newTable" || hasRole(destination.table.role, "ADMIN");
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [targets, setTargets] = useState<Target[]>([]);
  const [tableName, setTableName] = useState("");
  const [addMissingChoices, setAddMissingChoices] = useState(false);
  const check = useCheckImport(destination);
  const run = useRunImport(destination);

  const layout = file ? fileLayout(file.rows, hasHeader, t) : { headers: [], dataRows: [] };
  const { headers, dataRows } = layout;
  const valuesOf = (index: number) => dataRows.map((row) => row[index]);

  // New columns are named after their header, never like another column.
  const taken = tableColumns.map(({ name }) => name);
  const definitions = targets.map((target, index): ColumnDefinitionInput | null => {
    if (target.kind !== "new") {
      return null;
    }
    const definition = columnForFile(
      target.type,
      headers[index],
      valuesOf(index),
      taken,
      t("import.emptyChoice"),
    );
    taken.push(definition.name);
    return definition;
  });
  const targetInfo = targets.map((target, index): TargetInfo => {
    if (target.kind === "existing") {
      const column = tableColumns.find(({ id }) => id === target.id);
      return column ? { name: column.name, type: column.type } : null;
    }
    const definition = definitions[index];
    return definition ? { name: definition.name, type: definition.type } : null;
  });

  const body = (addChoices = addMissingChoices): ImportBody => ({
    columns: targets.map(
      (target, index): ImportTarget =>
        target.kind === "skip"
          ? null
          : target.kind === "existing"
            ? target.id
            : { create: definitions[index] as ColumnDefinitionInput },
    ),
    rows: dataRows,
    addMissingChoices: addChoices,
    name: tableName.trim(),
  });
  // The rows go to the API as JSON; a file over its limit is refused here first.
  const tooLarge = JSON.stringify(dataRows).length > MAX_BODY_CHARS;

  /** Same names map to existing columns; a table without columns gets new ones. */
  const initialTargets = (rows: string[][], header: boolean): Target[] => {
    const { headers: names, dataRows: data } = fileLayout(rows, header, t);
    const matched = header ? matchColumns(names, tableColumns) : [];
    const createByDefault = canChangeColumns && tableColumns.length === 0;
    return names.map((name, index): Target => {
      const id = matched[index];
      if (id) {
        return { kind: "existing", id };
      }
      return createByDefault
        ? { kind: "new", type: inferType(name, data.map((row) => row[index])) }
        : { kind: "skip" };
    });
  };

  const startOver = () => {
    setFile(null);
    setTargets([]);
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
    setTargets(initialTargets(rows, hasHeader));
    setTableName(selected.name.replace(/\.[^.]+$/, "").trim().slice(0, TABLE_NAME_MAX_LENGTH));
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
        fileName={file.name}
        headers={headers}
        samples={headers.map((_, index) => valuesOf(index).find((value) => value.trim()) ?? "")}
        rowCount={dataRows.length}
        tableColumns={tableColumns}
        canCreateColumns={canChangeColumns}
        targets={targets}
        newNames={definitions.map((definition) => definition?.name ?? null)}
        onTargetChange={(index, target) =>
          setTargets(targets.map((current, other) => (other === index ? target : current)))
        }
        onNewColumn={(index) =>
          setTargets(
            targets.map((current, other) =>
              other === index ? { kind: "new", type: inferType(headers[index], valuesOf(index)) } : current,
            ),
          )
        }
        tableName={destination.kind === "newTable" ? tableName : null}
        onTableNameChange={setTableName}
        hasHeader={hasHeader}
        onHasHeaderChange={(value) => {
          setHasHeader(value);
          setTargets(initialTargets(file.rows, value));
        }}
        error={
          tooLarge
            ? t("import.errors.tooLarge", { max: maxRows })
            : check.error && importErrorMessage(t, check.error, maxRows)
        }
        pending={check.isPending}
        onBack={startOver}
        onCheck={() => check.mutate(body())}
        canCheck={
          !tooLarge &&
          targets.some((target) => target.kind !== "skip") &&
          (destination.kind === "table" || tableName.trim() !== "")
        }
      />
    );
  }

  return (
    <ReviewStep
      result={check.data}
      targets={targetInfo}
      requiredNames={check.data.missingRequired.map(
        (id) => tableColumns.find((column) => column.id === id)?.name ?? "",
      )}
      canAddChoices={canChangeColumns}
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
            if (destination.kind === "newTable") {
              toast.success(t("import.createdTable", { name: tableName.trim(), count: result.imported }));
              void navigate(`/app/tables/${result.tableId}`);
            } else {
              toast.success(t("import.done", { count: result.imported }));
            }
            onDone();
          },
        })
      }
    />
  );
}

type Translate = ReturnType<typeof useTranslation<"records">>["t"];

/** Headers (or "Columna N") and data rows, all as wide as the file's longest row. */
function fileLayout(
  rows: string[][],
  hasHeader: boolean,
  t: Translate,
): { headers: string[]; dataRows: string[][] } {
  const width = Math.min(Math.max(0, ...rows.map((row) => row.length)), MAX_COLUMNS_PER_TABLE);
  const headers = Array.from({ length: width }, (_, index) =>
    hasHeader && rows[0][index]?.trim()
      ? rows[0][index].trim()
      : t("import.columnNumber", { number: index + 1 }),
  );
  const dataRows = rows
    .slice(hasHeader ? 1 : 0)
    .map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
  return { headers, dataRows };
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
  fileName,
  headers,
  samples,
  rowCount,
  tableColumns,
  canCreateColumns,
  targets,
  newNames,
  onTargetChange,
  onNewColumn,
  tableName,
  onTableNameChange,
  hasHeader,
  onHasHeaderChange,
  error,
  pending,
  onBack,
  onCheck,
  canCheck,
}: {
  fileName: string;
  headers: string[];
  samples: string[];
  rowCount: number;
  tableColumns: TableColumn[];
  canCreateColumns: boolean;
  targets: Target[];
  /** The name each new column will get. */
  newNames: (string | null)[];
  onTargetChange: (index: number, target: Target) => void;
  onNewColumn: (index: number) => void;
  /** Null when importing into an existing table. */
  tableName: string | null;
  onTableNameChange: (name: string) => void;
  hasHeader: boolean;
  onHasHeaderChange: (value: boolean) => void;
  error: string | null | undefined;
  pending: boolean;
  onBack: () => void;
  onCheck: () => void;
  canCheck: boolean;
}) {
  const { t } = useTranslation(["records", "tables"]);
  const ids = useId();
  const items = {
    [SKIP]: t("import.skip"),
    [NEW]: t("import.newColumn"),
    ...Object.fromEntries(tableColumns.map((column) => [column.id, column.name])),
  };
  const typeItems = Object.fromEntries(IMPORTABLE_TYPES.map((type) => [type, t(`tables:types.${type}`)]));
  const used = new Set(targets.flatMap((target) => (target.kind === "existing" ? [target.id] : [])));

  return (
    <div className="flex flex-col gap-5">
      <StepLabel step={2} />
      <p className="text-sm text-muted-foreground">
        {t("import.fileSummary", { name: fileName, count: rowCount })}
      </p>
      {tableName !== null && (
        <FormField
          id={`${ids}-name`}
          label={t("import.tableName")}
          error={tableName.trim() === "" ? t("tables:validation.tableName") : undefined}
        >
          <Input
            autoComplete="off"
            className="h-9"
            maxLength={TABLE_NAME_MAX_LENGTH}
            value={tableName}
            onChange={(event) => onTableNameChange(event.target.value)}
          />
        </FormField>
      )}
      <HeaderSwitch checked={hasHeader} onCheckedChange={onHasHeaderChange} />
      {error && <FormAlert>{error}</FormAlert>}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("import.mapping")}</legend>
        <p className="text-xs leading-5 text-muted-foreground">
          {canCreateColumns ? t("import.mappingHintNew") : t("import.mappingHint")}
        </p>
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {headers.map((header, index) => {
            const target = targets[index];
            const value = target.kind === "existing" ? target.id : target.kind === "new" ? NEW : SKIP;
            return (
              <li key={index} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-start">
                <span className="min-w-0 sm:pt-1.5">
                  <span className="block truncate text-sm font-medium">{header}</span>
                  {samples[index] && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {t("import.sample", { value: samples[index] })}
                    </span>
                  )}
                </span>
                <span className="flex flex-col gap-2">
                  <Select
                    items={items}
                    value={value}
                    onValueChange={(next) => {
                      if (next === NEW) {
                        onNewColumn(index);
                      } else {
                        onTargetChange(index, next && next !== SKIP ? { kind: "existing", id: next } : { kind: "skip" });
                      }
                    }}
                  >
                    <SelectTrigger aria-label={t("import.columnFor", { name: header })} className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP}>{t("import.skip")}</SelectItem>
                      {canCreateColumns && <SelectItem value={NEW}>{t("import.newColumn")}</SelectItem>}
                      {tableColumns.map((column) => (
                        <SelectItem
                          key={column.id}
                          value={column.id}
                          // Each table column takes one column of the file.
                          disabled={used.has(column.id) && value !== column.id}
                        >
                          {column.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {target.kind === "new" && (
                    <>
                      <Select
                        items={typeItems}
                        value={target.type}
                        onValueChange={(type) => type && onTargetChange(index, { kind: "new", type })}
                      >
                        <SelectTrigger aria-label={t("import.typeFor", { name: header })} className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {IMPORTABLE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {typeItems[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">
                        {t("import.newColumnName", { name: newNames[index] })}
                      </span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
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
  result,
  targets,
  requiredNames,
  canAddChoices,
  firstRowNumber,
  addMissingChoices,
  onAddMissingChoicesChange,
  checking,
  error,
  pending,
  onBack,
  onImport,
}: {
  result: ImportCheck;
  /** The table column each column of the file fills. */
  targets: TargetInfo[];
  /** Required table columns no column of the file fills. */
  requiredNames: string[];
  canAddChoices: boolean;
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
  const ready = result.errorCount === 0 && requiredNames.length === 0 && result.validRows > 0;

  return (
    <div className="flex flex-col gap-5">
      <StepLabel step={3} />
      <p role="status" className="text-sm font-medium">
        {ready
          ? t("import.ready", { count: result.validRows })
          : t("import.summary", { valid: result.validRows, count: result.rows, errors: result.errorCount })}
      </p>

      {requiredNames.length > 0 && (
        <FormAlert>{t("import.missingRequired", { names: requiredNames.join(", ") })}</FormAlert>
      )}

      {result.missingChoices.length > 0 && (
        <section aria-labelledby={`${ids}-choices`} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <h3 id={`${ids}-choices`} className="text-sm font-medium">
            {t("import.missingChoices")}
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {result.missingChoices.map(({ column, values }) => (
              <li key={column}>
                <span className="font-medium">{targets[column]?.name}:</span> {values.join(", ")}
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
              const column = targets[cellError.column];
              return (
                <li key={`${cellError.row}-${cellError.column}`}>
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

/** The API's reasons to refuse, in the dialog's words. */
function importErrorMessage(t: Translate, error: Error, maxRows: string): string {
  if (error instanceof ApiError && error.status === 413) {
    return t("import.errors.tooLarge", { max: maxRows });
  }
  if (error instanceof ApiError && error.status === 409) {
    return t("import.errors.conflict");
  }
  if (error instanceof ApiError && error.status === 422) {
    return t("import.errors.rejected");
  }
  if (error instanceof ApiError && error.status === 403) {
    return t("import.errors.forbidden");
  }
  return apiErrorMessage(error);
}
