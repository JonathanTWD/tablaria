import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INVITATION_TTL_DAYS, type PendingInvitation } from '@wisedata/shared';
import type { Env } from '../config/env.schema';
import type { Invitation, Prisma } from '../generated/prisma/client';
import { Mailer } from '../mail/mailer';
import { invitationEmail, type InvitationEmail } from './sharing-emails';

/** Rules shared by invitations to tables and to organizations (ADR-019). */

export const INVITATION_TTL_MS = INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Invitation emails per hour, counting re-sent and revoked ones, so nobody can
 * use WiseData to flood a mailbox or send mass email.
 */
const EMAILS_PER_RECIPIENT_PER_HOUR = 5;
const INVITATIONS_PER_SENDER_PER_HOUR = 30;
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Pending: neither accepted nor revoked, and not expired. */
export function pending(now = new Date()): Prisma.InvitationWhereInput {
  return { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

export function toPendingInvitation(invitation: Invitation): PendingInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}

/**
 * Throws unless this person may send one more invitation email to `email`
 * now; returns the inviter's email for the message.
 */
export async function checkInvitationAllowed(
  tx: Prisma.TransactionClient,
  inviterId: string,
  email: string,
  now: Date,
): Promise<string> {
  const inviter = await tx.user.findUniqueOrThrow({
    where: { id: inviterId },
    select: { email: true, demoExpiresAt: true },
  });
  // The demo is public: it must never send email to arbitrary addresses.
  if (inviter.demoExpiresAt) {
    throw new ForbiddenException('Demo accounts cannot invite people');
  }
  const hourAgo = new Date(now.getTime() - ONE_HOUR_MS);
  const [toRecipient, fromSender] = await Promise.all([
    tx.invitation.count({ where: { email, createdAt: { gt: hourAgo } } }),
    tx.invitation.count({
      where: { invitedById: inviterId, createdAt: { gt: hourAgo } },
    }),
  ]);
  if (
    toRecipient >= EMAILS_PER_RECIPIENT_PER_HOUR ||
    fromSender >= INVITATIONS_PER_SENDER_PER_HOUR
  ) {
    throw new HttpException(
      'Too many invitations, try again later',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  return inviter.email;
}

/** Emails the invitation link. */
@Injectable()
export class InvitationSender {
  private readonly logger = new Logger(InvitationSender.name);
  private readonly appUrl: string;

  constructor(
    private readonly mailer: Mailer,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true });
  }

  /**
   * Delivery failures are logged, not returned: the invitation exists and the
   * admin can send it again. Demo addresses (.invalid) never receive email.
   */
  async send(
    to: string,
    token: string,
    details: Omit<InvitationEmail, 'url' | 'days'>,
  ): Promise<void> {
    if (to.endsWith('.invalid')) {
      return;
    }
    const url = `${this.appUrl}/invitations?token=${encodeURIComponent(token)}`;
    try {
      await this.mailer.send({
        to,
        ...invitationEmail({ ...details, url, days: INVITATION_TTL_DAYS }),
      });
    } catch (error) {
      this.logger.error(
        'Failed to send an invitation email',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
