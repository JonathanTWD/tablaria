import { HttpException } from '@nestjs/common';
import {
  type AssistantSource,
  type CellValue,
  type ColumnType,
  FILTER_OPERATOR_BY_TYPE,
  type RecordFilter,
  recordFilterSchema,
  type TableColumn,
} from '@tablaria/shared';
import { z } from 'zod';
import { toTableColumn } from '../columns/column-mapper';
import { PrismaService } from '../database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { RecordsService } from '../records/records.service';
import { StockAlertsService } from '../stock-alerts/stock-alerts.service';
import { StockMovementsService } from '../stock-movements/stock-movements.service';
import { accessibleTables } from '../tables/table-access';
import type { ChatTool } from './chat-model';

/** A mistake the model can fix: it gets the message back, not the user. */
export class ToolError extends Error {}

export interface ToolContext {
  userId: string;
  prisma: PrismaService;
  records: RecordsService;
  metrics: MetricsService;
  stockAlerts: StockAlertsService;
  stockMovements: StockMovementsService;
  /** What the answer was based on, to link to it. */
  sources: AssistantSource[];
}

interface Tool {
  definition: ChatTool;
  run: (context: ToolContext, args: unknown) => Promise<unknown>;
}

const TYPE_NAMES: Record<ColumnType, string> = {
  text: 'texto',
  number: 'número',
  date: 'fecha',
  boolean: 'sí/no',
  select: 'opciones',
  currency: 'precio',
  relation: 'enlace',
  lookup: 'consulta',
  rollup: 'resumen',
  formula: 'fórmula',
};

const MAX_RECORDS = 20;
const MAX_SOURCES = 8;

function tool(
  name: string,
  description: string,
  parameters: object,
  run: Tool['run'],
): Tool {
  return {
    definition: {
      type: 'function',
      function: { name, description, parameters },
    },
    run,
  };
}

const uuid = { type: 'string', description: 'Id (UUID) de la tabla' };

/**
 * Read-only tools the model can call (ADR-042). Each one validates its
 * arguments and runs through the API's own services as the user, so the
 * assistant never sees more than the user does, nor changes anything.
 */
export const ASSISTANT_TOOLS: Record<string, Tool> = {
  listar_tablas: tool(
    'listar_tablas',
    'Las tablas que el usuario puede abrir, con sus columnas y su tipo.',
    { type: 'object', properties: {} },
    async (context) => {
      const tables = await context.prisma.inventoryTable.findMany({
        where: accessibleTables(context.userId),
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          name: true,
          columns: {
            orderBy: { position: 'asc' },
            select: { name: true, type: true },
          },
        },
      });
      return tables.map((table) => ({
        id: table.id,
        nombre: table.name,
        columnas: table.columns
          .map(({ name, type }) => `${name} (${TYPE_NAMES[type]})`)
          .join(', '),
      }));
    },
  ),

  buscar_registros: tool(
    'buscar_registros',
    'Busca registros de una tabla, con texto, filtros por columna y orden. Devuelve como mucho 20.',
    {
      type: 'object',
      properties: {
        tabla: uuid,
        texto: {
          type: 'string',
          description: 'Texto a buscar en todas las columnas',
        },
        filtros: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              columna: { type: 'string', description: 'Nombre de la columna' },
              contiene: { type: 'string', description: 'Para texto y enlaces' },
              igual: {
                type: ['string', 'number', 'boolean'],
                description: 'Una opción, un sí/no o un número exacto',
              },
              desde: {
                type: ['number', 'string'],
                description: 'Mínimo: número o fecha AAAA-MM-DD',
              },
              hasta: {
                type: ['number', 'string'],
                description: 'Máximo: número o fecha AAAA-MM-DD',
              },
            },
            required: ['columna'],
          },
        },
        ordenar_por: { type: 'string', description: 'Nombre de la columna' },
        orden: { type: 'string', enum: ['asc', 'desc'] },
        limite: { type: 'integer', minimum: 1, maximum: MAX_RECORDS },
      },
      required: ['tabla'],
    },
    async (context, rawArgs) => {
      const args = parseArgs(
        z.object({
          tabla: z.uuid(),
          texto: z.string().trim().max(200).optional(),
          filtros: z
            .array(
              z.object({
                columna: z.string(),
                contiene: z.string().trim().max(200).optional(),
                igual: z
                  .union([z.string().max(100), z.number(), z.boolean()])
                  .optional(),
                desde: z.union([z.number(), z.iso.date()]).optional(),
                hasta: z.union([z.number(), z.iso.date()]).optional(),
              }),
            )
            .max(5)
            .optional(),
          ordenar_por: z.string().optional(),
          orden: z.enum(['asc', 'desc']).optional(),
          limite: z.number().int().min(1).max(MAX_RECORDS).optional(),
        }),
        rawArgs,
      );
      const table = await loadTable(context, args.tabla);
      const filters = (args.filtros ?? []).map((filter) =>
        toFilter(findColumn(table.columns, filter.columna), filter),
      );
      const page = await asTool(() =>
        context.records.list(context.userId, table.id, {
          page: 1,
          pageSize: args.limite ?? 10,
          search: args.texto || undefined,
          sort: args.ordenar_por
            ? findColumn(table.columns, args.ordenar_por).id
            : undefined,
          order: args.orden ?? 'asc',
          filters,
        }),
      );
      const rows = page.data.map((record) => {
        const cells: Record<string, string | number> = { id: record.id };
        for (const column of table.columns) {
          const value = describe(column, record.data[column.id], page.linked);
          if (value !== null) {
            cells[column.name] = value;
          }
        }
        addSource(context, {
          tableId: table.id,
          tableName: table.name,
          recordId: record.id,
          label: String(cells[table.columns[0]?.name] ?? 'Registro'),
        });
        return cells;
      });
      return { total: page.meta.total, registros: rows };
    },
  ),

  resumir: tool(
    'resumir',
    'Totales de una tabla: sin agrupar, suma, media, mínimo y máximo de cada columna numérica; agrupando por una columna, cuántos registros (o la suma, media, mínimo o máximo de otra columna) hay en cada grupo.',
    {
      type: 'object',
      properties: {
        tabla: uuid,
        agrupar_por: {
          type: 'string',
          description: 'Nombre de la columna (opciones, sí/no, texto o enlace)',
        },
        medir: {
          type: 'string',
          description: 'Columna numérica a medir en cada grupo',
        },
        funcion: { type: 'string', enum: ['sum', 'avg', 'min', 'max'] },
      },
      required: ['tabla'],
    },
    async (context, rawArgs) => {
      const args = parseArgs(
        z.object({
          tabla: z.uuid(),
          agrupar_por: z.string().optional(),
          medir: z.string().optional(),
          funcion: z.enum(['sum', 'avg', 'min', 'max']).optional(),
        }),
        rawArgs,
      );
      const table = await loadTable(context, args.tabla);
      addSource(context, {
        tableId: table.id,
        tableName: table.name,
        label: table.name,
      });
      if (!args.agrupar_por) {
        const summary = await asTool(() =>
          context.metrics.summary(context.userId, table.id),
        );
        return {
          registros: summary.total,
          columnas: summary.columns.map((column) => ({
            columna: table.columns.find(({ id }) => id === column.columnId)
              ?.name,
            con_valor: column.filled,
            suma: column.sum,
            media:
              column.avg === null ? null : Math.round(column.avg * 100) / 100,
            minimo: column.min,
            maximo: column.max,
          })),
        };
      }
      const groups = await asTool(() =>
        context.metrics.groups(context.userId, table.id, {
          groupBy: findColumn(table.columns, args.agrupar_por ?? '').id,
          column: args.medir
            ? findColumn(table.columns, args.medir).id
            : undefined,
          fn: args.funcion ?? 'sum',
        }),
      );
      return {
        registros: groups.total,
        grupos: groups.groups.map((group) => ({
          valor:
            group.value === null
              ? '(vacío)'
              : (groups.labels[String(group.value)] ?? group.value),
          registros: group.count,
          ...(args.medir && { medida: group.measure }),
        })),
        otros: groups.others && {
          grupos: groups.others.groupCount,
          registros: groups.others.count,
        },
      };
    },
  ),

  bajo_minimo: tool(
    'bajo_minimo',
    'Registros con una columna por debajo de su mínimo (stock bajo), en todas las tablas o en una, con todas sus columnas (proveedor incluido).',
    { type: 'object', properties: { tabla: uuid } },
    async (context, rawArgs) => {
      const args = parseArgs(z.object({ tabla: z.uuid().optional() }), rawArgs);
      const alerts = await asTool(() =>
        context.stockAlerts.list(context.userId, { tableId: args.tabla }),
      );
      const registros: Record<string, unknown>[] = [];
      for (const alert of alerts.items) {
        addSource(context, {
          tableId: alert.tableId,
          tableName: alert.tableName,
          recordId: alert.recordId,
          label: alert.label ?? 'Registro',
        });
        registros.push({
          tabla: alert.tableName,
          columna: alert.columnName,
          valor: alert.value,
          minimo: alert.alertBelow,
          celdas: await rowOf(context, alert.tableId, alert.recordId),
        });
      }
      return { total: alerts.total, registros };
    },
  ),

  historial_stock: tool(
    'historial_stock',
    'Las últimas entradas, salidas y recuentos de stock de un registro.',
    {
      type: 'object',
      properties: {
        tabla: uuid,
        registro: { type: 'string', description: 'Id (UUID) del registro' },
      },
      required: ['tabla', 'registro'],
    },
    async (context, rawArgs) => {
      const args = parseArgs(
        z.object({ tabla: z.uuid(), registro: z.uuid() }),
        rawArgs,
      );
      const table = await loadTable(context, args.tabla);
      const history = await asTool(() =>
        context.stockMovements.history(
          context.userId,
          table.id,
          args.registro,
          {},
        ),
      );
      return {
        total: history.total,
        movimientos: history.data.slice(0, 10).map((movement) => ({
          fecha: movement.createdAt.slice(0, 10),
          columna: table.columns.find(({ id }) => id === movement.columnId)
            ?.name,
          tipo: movement.kind,
          cambio: movement.delta,
          saldo: movement.balance,
          ...(movement.note && { nota: movement.note }),
          ...(movement.by && { por: movement.by }),
        })),
      };
    },
  ),
};

function parseArgs<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ToolError(
      `Argumentos no válidos: ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

/** The API's own refusals (no access, bad filter) go back to the model to correct. */
async function asTool<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HttpException) {
      throw new ToolError(error.message);
    }
    throw error;
  }
}

async function loadTable(
  context: ToolContext,
  tableId: string,
): Promise<{ id: string; name: string; columns: TableColumn[] }> {
  const table = await context.prisma.inventoryTable.findFirst({
    where: { id: tableId, ...accessibleTables(context.userId) },
    select: { id: true, name: true, columns: { orderBy: { position: 'asc' } } },
  });
  if (!table) {
    throw new ToolError('Esa tabla no existe o el usuario no puede abrirla.');
  }
  return { ...table, columns: table.columns.map(toTableColumn) };
}

function findColumn(columns: TableColumn[], name: string): TableColumn {
  const wanted = name.trim().toLocaleLowerCase();
  const column = columns.find(
    (candidate) => candidate.name.toLocaleLowerCase() === wanted,
  );
  if (!column) {
    throw new ToolError(
      `No hay ninguna columna «${name}». Columnas: ${columns.map(({ name }) => name).join(', ')}.`,
    );
  }
  return column;
}

/** The filter the column supports, from the loose shape the model sends. */
function toFilter(
  column: TableColumn,
  filter: {
    contiene?: string;
    igual?: string | number | boolean;
    desde?: number | string;
    hasta?: number | string;
  },
): RecordFilter {
  const op = FILTER_OPERATOR_BY_TYPE[column.type];
  const candidate =
    op === 'contains'
      ? {
          columnId: column.id,
          op,
          value: filter.contiene ?? String(filter.igual ?? ''),
        }
      : op === 'between'
        ? {
            columnId: column.id,
            op,
            min: typeof filter.igual === 'number' ? filter.igual : filter.desde,
            max: typeof filter.igual === 'number' ? filter.igual : filter.hasta,
          }
        : op === 'is'
          ? {
              columnId: column.id,
              op,
              value:
                filter.igual === true ||
                filter.igual === 'sí' ||
                filter.igual === 'true',
            }
          : {
              columnId: column.id,
              op,
              values: [String(filter.igual ?? filter.contiene ?? '')],
            };
  const result = recordFilterSchema.safeParse(candidate);
  if (!result.success) {
    throw new ToolError(
      `El filtro de «${column.name}» no es válido para una columna de tipo ${TYPE_NAMES[column.type]}.`,
    );
  }
  return result.data;
}

/** A cell as short text for the model, with linked records by their name. */
function describe(
  column: TableColumn,
  value: CellValue | undefined,
  linked: Record<string, string>,
): string | number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((id) => linked[id] ?? '(sin acceso)').join(', ');
  }
  if (typeof value === 'boolean') {
    return value ? 'sí' : 'no';
  }
  if (column.type === 'relation') {
    return linked[String(value)] ?? '(sin acceso)';
  }
  if (column.type === 'currency' && typeof value === 'number') {
    return `${value} ${column.options.currency}`;
  }
  return value;
}

/** Every cell of one record, as `buscar_registros` shows them. */
async function rowOf(
  context: ToolContext,
  tableId: string,
  recordId: string,
): Promise<Record<string, string | number>> {
  const table = await loadTable(context, tableId);
  const { record, linked } = await asTool(() =>
    context.records.get(context.userId, tableId, recordId),
  );
  const cells: Record<string, string | number> = {};
  for (const column of table.columns) {
    const value = describe(column, record.data[column.id], linked);
    if (value !== null) {
      cells[column.name] = value;
    }
  }
  return cells;
}

function addSource(context: ToolContext, source: AssistantSource): void {
  const key = `${source.tableId}:${source.recordId ?? ''}`;
  if (
    context.sources.length < MAX_SOURCES &&
    !context.sources.some(
      (known) => `${known.tableId}:${known.recordId ?? ''}` === key,
    )
  ) {
    context.sources.push(source);
  }
}
