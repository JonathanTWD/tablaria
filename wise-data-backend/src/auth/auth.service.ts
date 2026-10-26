import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AuthUser,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@wisedata/shared';
import type { Env } from '../config/env.schema';
import { EmailTokenType, Prisma, type User } from '../generated/prisma/client';
import { Mailer } from '../mail/mailer';
import { toAuthUser, UsersService } from '../users/users.service';
import {
  accountExistsEmail,
  passwordResetEmail,
  verificationEmail,
} from './auth-emails';
import { EmailTokenService } from './email-token.service';
import { PasswordService } from './password.service';
import { SessionService, type SessionTokens } from './session.service';

export interface AuthenticatedSession {
  user: AuthUser;
  tokens: SessionTokens;
}

@Injectable()
export class AuthService {
  private readonly appUrl: string;

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly emailTokens: EmailTokenService,
    private readonly sessions: SessionService,
    private readonly mailer: Mailer,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true });
  }

  /**
   * Always succeeds from the caller's point of view so the response never
   * reveals whether an email is registered; the mailbox owner gets the details.
   */
  async register({ email, password }: RegisterInput): Promise<void> {
    // Hash before the lookup so both branches take comparable time.
    const passwordHash = await this.passwords.hash(password);
    const existing = await this.users.findByEmail(email);

    if (existing) {
      await this.notifyExistingAccount(existing);
      return;
    }

    let user: User;
    try {
      user = await this.users.create(email, passwordHash);
    } catch (error) {
      // A concurrent registration with the same email won the race.
      if (isUniqueViolation(error)) {
        return;
      }
      throw error;
    }
    await this.sendVerificationEmail(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.emailTokens.consume(
      token,
      EmailTokenType.VERIFY_EMAIL,
    );
    await this.users.markEmailVerified(userId);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (user && !user.emailVerifiedAt) {
      await this.sendVerificationEmail(user);
    }
  }

  async login({ email, password }: LoginInput): Promise<AuthenticatedSession> {
    const user = await this.users.findByEmail(email);
    const passwordMatches = user
      ? await this.passwords.verify(user.passwordHash, password)
      : await this.passwords.verifyAgainstDummy(password);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    // Only revealed after a correct password, so it does not leak account state.
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Email not verified');
    }

    const tokens = await this.sessions.start(user.id);
    return { user: toAuthUser(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthenticatedSession> {
    const { userId, tokens } = await this.sessions.rotate(refreshToken);
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    return { user: toAuthUser(user), tokens };
  }

  logout(refreshToken: string): Promise<void> {
    return this.sessions.end(refreshToken);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return toAuthUser(user);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      return;
    }
    const token = await this.emailTokens.issue(
      user.id,
      EmailTokenType.RESET_PASSWORD,
    );
    await this.mailer.send({
      to: user.email,
      ...passwordResetEmail(this.link('/reset-password', token)),
    });
  }

  async resetPassword({ token, password }: ResetPasswordInput): Promise<void> {
    const userId = await this.emailTokens.consume(
      token,
      EmailTokenType.RESET_PASSWORD,
    );
    const passwordHash = await this.passwords.hash(password);
    const user = await this.users.updatePassword(userId, passwordHash);

    // Receiving the reset email proves ownership of the address.
    if (!user.emailVerifiedAt) {
      await this.users.markEmailVerified(userId);
    }
    // A new password must log out every existing session.
    await this.sessions.endAllForUser(userId);
  }

  private async notifyExistingAccount(user: User): Promise<void> {
    if (!user.emailVerifiedAt) {
      await this.sendVerificationEmail(user);
      return;
    }
    await this.mailer.send({
      to: user.email,
      ...accountExistsEmail(`${this.appUrl}/login`),
    });
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const token = await this.emailTokens.issue(
      user.id,
      EmailTokenType.VERIFY_EMAIL,
    );
    await this.mailer.send({
      to: user.email,
      ...verificationEmail(this.link('/verify-email', token)),
    });
  }

  private link(path: string, token: string): string {
    return `${this.appUrl}${path}?token=${encodeURIComponent(token)}`;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
