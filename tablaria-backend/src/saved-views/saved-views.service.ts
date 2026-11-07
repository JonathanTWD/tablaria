import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MAX_SAVED_VIEWS_PER_TABLE,
  type SavedView,
  type SavedViewInput,
  type SavedViewQuery,
  savedViewQuerySchema,
  type SavedViewUpdate,
} from '@tablaria/shared';
import { displayName } from '../common/display-name';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { RealtimeService } from '../realtime/realtime.service';
import { requireTableRole } from '../tables/table-access';

type Db = Prisma.TransactionClient;

const WITH_AUTHOR = {
  createdBy: { select: { email: true, demoExpiresAt: true } },
} as const;

type StoredView = Prisma.SavedViewGetPayload<{ include: typeof WITH_AUTHOR }>;

/**
 * Named views of a table (ADR-041): everyone who can open the table sees and
 * opens them, editors save, rename and delete them.
 */
@Injectable()
export class SavedViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(userId: string, tableId: string): Promise<SavedView[]> {
    await requireTableRole(this.prisma, userId, tableId, 'VIEWER');
    const views = await this.prisma.savedView.findMany({
      where: { tableId },
      include: WITH_AUTHOR,
      orderBy: { name: 'asc' },
    });
    return views.map(toSavedView);
  }

  async create(
    userId: string,
    tableId: string,
    input: SavedViewInput,
  ): Promise<SavedView> {
    const view = await this.prisma.$transaction(async (tx) => {
      await requireTableRole(tx, userId, tableId, 'EDITOR');
      // Two saves at once wait for each other, so neither passes the limit on
      // a stale count. Not touchTable: a view is not an edit of the table.
      await tx.$queryRaw`
        SELECT 1 FROM inventory_tables WHERE id = ${tableId}::uuid FOR UPDATE`;
      await requireTableColumns(tx, tableId, input.view);
      const count = await tx.savedView.count({ where: { tableId } });
      if (count >= MAX_SAVED_VIEWS_PER_TABLE) {
        throw new UnprocessableEntityException('Saved view limit reached');
      }
      // A repeated name is a 409 from the unique index (tableId, name).
      return tx.savedView.create({
        data: {
          tableId,
          createdById: userId,
          name: input.name,
          view: input.view,
        },
        include: WITH_AUTHOR,
      });
    });
    this.realtime.publish(tableId, 'views');
    return toSavedView(view);
  }

  async update(
    userId: string,
    tableId: string,
    viewId: string,
    input: SavedViewUpdate,
  ): Promise<SavedView> {
    const view = await this.prisma.$transaction(async (tx) => {
      await requireTableRole(tx, userId, tableId, 'EDITOR');
      await requireView(tx, tableId, viewId);
      if (input.view) {
        await requireTableColumns(tx, tableId, input.view);
      }
      return tx.savedView.update({
        where: { id: viewId },
        data: { name: input.name, view: input.view },
        include: WITH_AUTHOR,
      });
    });
    this.realtime.publish(tableId, 'views');
    return toSavedView(view);
  }

  async remove(userId: string, tableId: string, viewId: string): Promise<void> {
    await requireTableRole(this.prisma, userId, tableId, 'EDITOR');
    const { count } = await this.prisma.savedView.deleteMany({
      where: { id: viewId, tableId },
    });
    if (count === 0) {
      throw new NotFoundException('Saved view not found');
    }
    this.realtime.publish(tableId, 'views');
  }
}

async function requireView(db: Db, tableId: string, viewId: string) {
  const view = await db.savedView.findFirst({
    where: { id: viewId, tableId },
    select: { id: true },
  });
  if (!view) {
    throw new NotFoundException('Saved view not found');
  }
}

/** A view may only name columns of its own table. */
async function requireTableColumns(
  db: Db,
  tableId: string,
  view: SavedViewQuery,
): Promise<void> {
  const named = new Set(
    [
      view.sort,
      view.group,
      ...view.filters.map(({ columnId }) => columnId),
    ].filter((id): id is string => id !== undefined),
  );
  if (named.size === 0) {
    return;
  }
  const found = await db.column.count({
    where: { tableId, id: { in: [...named] } },
  });
  if (found !== named.size) {
    throw new BadRequestException('Unknown column in the view');
  }
}

/**
 * Stored through the same schema; reading it again fills defaults added
 * later. A view an older release saved and today's schema refuses opens as
 * the plain table instead of breaking the whole list.
 */
function storedQuery(stored: Prisma.JsonValue): SavedViewQuery {
  const parsed = savedViewQuerySchema.safeParse(stored);
  return parsed.success ? parsed.data : savedViewQuerySchema.parse({});
}

function toSavedView(view: StoredView): SavedView {
  return {
    id: view.id,
    name: view.name,
    view: storedQuery(view.view),
    createdBy: view.createdBy ? displayName(view.createdBy) : null,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}
