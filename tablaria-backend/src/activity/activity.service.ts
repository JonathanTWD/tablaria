import { Injectable } from '@nestjs/common';
import {
  ACTIVITY_PAGE_SIZE,
  type ActivityAction,
  type ActivityDetails,
  type ActivityPage,
  type ActivityQuery,
} from '@tablaria/shared';
import { displayName } from '../common/display-name';
import { PrismaService } from '../database/prisma.service';
import type { ActivityAction as StoredAction } from '../generated/prisma/client';
import { requireTableRole } from '../tables/table-access';
import { STORED_ACTIONS } from './activity-log';

const ACTIONS = Object.fromEntries(
  Object.entries(STORED_ACTIONS).map(([action, stored]) => [stored, action]),
) as Record<StoredAction, ActivityAction>;

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest first. Anyone who can open the table may read it. */
  async list(
    userId: string,
    tableId: string,
    { page }: ActivityQuery,
  ): Promise<ActivityPage> {
    await requireTableRole(this.prisma, userId, tableId, 'VIEWER');
    const [events, total] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where: { tableId },
        include: { user: { select: { email: true, demoExpiresAt: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * ACTIVITY_PAGE_SIZE,
        take: ACTIVITY_PAGE_SIZE,
      }),
      this.prisma.activityEvent.count({ where: { tableId } }),
    ]);
    return {
      data: events.map((event) => ({
        id: event.id,
        action: ACTIONS[event.action],
        by: event.user ? displayName(event.user) : null,
        mine: event.userId === userId,
        label: event.label,
        recordId: event.recordId,
        details: event.details as ActivityDetails,
        createdAt: event.createdAt.toISOString(),
      })),
      meta: {
        page,
        pageSize: ACTIVITY_PAGE_SIZE,
        total,
        pageCount: Math.ceil(total / ACTIVITY_PAGE_SIZE),
      },
    };
  }
}
