import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { REFRESH_TOKEN_TTL_MS } from './auth.constants';
import { generateSecureToken, hashToken } from './secure-token';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
}

/**
 * Short-lived JWT access tokens plus opaque, rotating refresh tokens.
 * Every refresh token belongs to a family (one login); reusing a rotated
 * token is treated as theft and revokes the whole family.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  start(userId: string): Promise<SessionTokens> {
    return this.issue(userId, randomUUID());
  }

  async rotate(
    refreshToken: string,
  ): Promise<{ userId: string; tokens: SessionTokens }> {
    const now = new Date();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });

    if (!stored || stored.expiresAt <= now) {
      throw invalidSession();
    }

    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (count === 0) {
      await this.revokeFamily(stored.familyId);
      throw invalidSession();
    }

    const tokens = await this.issue(stored.userId, stored.familyId, stored.id);
    return { userId: stored.userId, tokens };
  }

  /** Ends the session (whole family) the refresh token belongs to, if any. */
  async end(refreshToken: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    });
    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
  }

  async endAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      algorithms: ['HS256'],
    });
  }

  private async issue(
    userId: string,
    familyId: string,
    previousTokenId?: string,
  ): Promise<SessionTokens> {
    const refreshToken = generateSecureToken();

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId,
          familyId,
          tokenHash: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });
      if (previousTokenId) {
        await tx.refreshToken.update({
          where: { id: previousTokenId },
          data: { replacedById: created.id },
        });
      }
    });

    const payload: AccessTokenPayload = { sub: userId };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, refreshToken };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function invalidSession() {
  return new UnauthorizedException('Invalid session');
}
