import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreatedPublicLink,
  isComputedType,
  type PublicLinkStatus,
  type PublicTable,
  publicTokenSchema,
  type RecordListQuery,
} from '@tablaria/shared';
import { generateSecureToken, hashToken } from '../auth/secure-token';
import { toTableColumn } from '../columns/column-mapper';
import { auditPermission } from '../common/permission-audit';
import { PrismaService } from '../database/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { queryRecordPage } from '../records/records.service';
import { requireTableRole } from '../tables/table-access';

@Injectable()
export class PublicLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async status(userId: string, tableId: string): Promise<PublicLinkStatus> {
    await requireTableRole(this.prisma, userId, tableId, 'ADMIN');
    const link = await this.prisma.publicLink.findUnique({
      where: { tableId },
    });
    return {
      enabled: link !== null,
      createdAt: link?.createdAt.toISOString() ?? null,
    };
  }

  /** A new link; the previous one, if any, stops working. */
  async create(userId: string, tableId: string): Promise<CreatedPublicLink> {
    await requireTableRole(this.prisma, userId, tableId, 'ADMIN');
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { demoExpiresAt: true },
    });
    // Anyone could otherwise publish text under this domain for a day.
    if (user.demoExpiresAt) {
      throw new ForbiddenException('Not available in the demo');
    }
    const token = generateSecureToken();
    const link = await this.prisma.publicLink.upsert({
      where: { tableId },
      create: { tableId, tokenHash: hashToken(token), createdById: userId },
      update: {
        tokenHash: hashToken(token),
        createdById: userId,
        createdAt: new Date(),
      },
    });
    auditPermission('table.public_link.create', { tableId, by: userId });
    this.realtime.publish(tableId, 'sharing');
    return { token, createdAt: link.createdAt.toISOString() };
  }

  async remove(userId: string, tableId: string): Promise<void> {
    await requireTableRole(this.prisma, userId, tableId, 'ADMIN');
    const { count } = await this.prisma.publicLink.deleteMany({
      where: { tableId },
    });
    if (count === 0) {
      throw new NotFoundException('No public link');
    }
    auditPermission('table.public_link.remove', { tableId, by: userId });
    this.realtime.publish(tableId, 'sharing');
  }

  /**
   * The table behind a link, read-only. Relation columns are left out: they
   * would point to tables the link doesn't open.
   */
  async read(
    token: string | undefined,
    query: RecordListQuery,
  ): Promise<PublicTable> {
    const parsed = publicTokenSchema.safeParse(token);
    const link = parsed.success
      ? await this.prisma.publicLink.findUnique({
          where: { tokenHash: hashToken(parsed.data) },
          include: {
            table: {
              select: {
                name: true,
                description: true,
                columns: { orderBy: { position: 'asc' } },
              },
            },
          },
        })
      : null;
    if (!link) {
      throw new NotFoundException('Link not found');
    }

    const columns = link.table.columns
      // Relations open other tables, and computed columns read through them.
      .filter(({ type }) => type !== 'relation' && !isComputedType(type))
      .map(toTableColumn);
    const visible = new Set(columns.map(({ id }) => id));
    const page = await queryRecordPage(
      this.prisma,
      link.tableId,
      columns,
      query,
    );
    return {
      name: link.table.name,
      description: link.table.description,
      columns,
      records: {
        ...page,
        data: page.data.map((record) => ({
          ...record,
          data: Object.fromEntries(
            Object.entries(record.data).filter(([id]) => visible.has(id)),
          ),
        })),
      },
    };
  }
}
