import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailTokenType } from '../generated/prisma/client';
import { generateSecureToken, hashToken } from './secure-token';

const TOKEN_TTL_MS: Record<EmailTokenType, number> = {
  [EmailTokenType.VERIFY_EMAIL]: 24 * 60 * 60 * 1000,
  [EmailTokenType.RESET_PASSWORD]: 60 * 60 * 1000,
};

/** Single-use tokens sent by email (verification and password reset). */
@Injectable()
export class EmailTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Issues a new token and invalidates any previous unused one of the same type. */
  async issue(userId: string, type: EmailTokenType): Promise<string> {
    const token = generateSecureToken();
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.emailToken.updateMany({
        where: { userId, type, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.emailToken.create({
        data: {
          userId,
          type,
          tokenHash: hashToken(token),
          expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[type]),
        },
      }),
    ]);

    return token;
  }

  /** Marks the token as used and returns its user id, or throws if it is invalid, used or expired. */
  async consume(token: string, type: EmailTokenType): Promise<string> {
    const now = new Date();
    const stored = await this.prisma.emailToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });

    if (!stored || stored.type !== type || stored.expiresAt <= now) {
      throw invalidToken();
    }

    // Conditional update so two concurrent requests cannot both use the same token.
    const { count } = await this.prisma.emailToken.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: now },
    });
    if (count === 0) {
      throw invalidToken();
    }

    return stored.userId;
  }
}

function invalidToken() {
  return new BadRequestException('Invalid or expired token');
}
