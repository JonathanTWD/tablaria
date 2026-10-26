import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { REFRESH_REUSE_GRACE_MS, REFRESH_TOKEN_TTL_MS } from './auth.constants';
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

    // Claiming the token and linking its successor in one conditional update lets
    // a concurrent request tell "just rotated" apart from logout or reset.
    const successorId = randomUUID();
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: now, replacedById: successorId },
    });
    if (count === 0) {
      await this.handleRevokedToken(stored.id, stored.familyId, now);
    }

    const tokens = await this.issue(
      stored.userId,
      stored.familyId,
      successorId,
    );
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

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      algorithms: ['HS256'],
    });
  }

  private async issue(
    userId: string,
    familyId: string,
    tokenId: string = randomUUID(),
  ): Promise<SessionTokens> {
    const refreshToken = generateSecureToken();

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    const payload: AccessTokenPayload = { sub: userId };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, refreshToken };
  }

  /**
   * A token rotated moments ago was most likely used by a parallel request from
   * the same browser (several tabs refreshing at once): answer without new tokens
   * and keep the session. Older reuse, or reuse after logout/reset, is treated as theft.
   */
  private async handleRevokedToken(
    tokenId: string,
    familyId: string,
    now: Date,
  ): Promise<never> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      select: { revokedAt: true, replacedById: true },
    });
    const rotatedAt = current?.replacedById ? current.revokedAt?.getTime() : 0;
    if (rotatedAt && now.getTime() - rotatedAt < REFRESH_REUSE_GRACE_MS) {
      throw new RefreshSupersededException();
    }

    await this.revokeFamily(familyId);
    throw invalidSession();
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

/** The token was just rotated by a concurrent request; the browser already holds the new cookies. */
export class RefreshSupersededException extends ConflictException {
  constructor() {
    super('Session already refreshed');
  }
}

function invalidSession() {
  return new UnauthorizedException('Invalid session');
}
