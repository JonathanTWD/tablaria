import { Injectable } from '@nestjs/common';
import type { AuthUser } from '@wisedata/shared';
import { PrismaService } from '../database/prisma.service';
import type { User } from '../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(email: string, passwordHash: string): Promise<User> {
    return this.prisma.user.create({ data: { email, passwordHash } });
  }

  /**
   * Sets a password proven by an email link: marks the address as verified
   * and ends every existing session, atomically.
   */
  setVerifiedPassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.user.updateMany({
        where: { id, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
      return tx.user.update({ where: { id }, data: { passwordHash } });
    });
  }
}

/** The only user shape that may leave the API: never includes the password hash. */
export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    demoExpiresAt: user.demoExpiresAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
