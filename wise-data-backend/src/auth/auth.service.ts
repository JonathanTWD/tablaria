import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AuthUser,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@wisedata/shared';
import type { Env } from '../config/env.schema';
import { DemoService } from '../demo/demo.service';
import { EmailTokenType, Prisma, type User } from '../generated/prisma/client';
import { type MailMessage, Mailer } from '../mail/mailer';
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
  private readonly logger = new Logger(AuthService.name);
  private readonly appUrl: string;
  private readonly demoEnabled: boolean;

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly emailTokens: EmailTokenService,
    private readonly sessions: SessionService,
    private readonly demo: DemoService,
    private readonly mailer: Mailer,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true });
    this.demoEnabled = config.get('DEMO_ENABLED', { infer: true });
  }

  /**
   * Always succeeds from the caller's point of view so the response never
   * reveals whether an email is registered; the mailbox owner gets the details.
   */
  async register({ email, password }: RegisterInput): Promise<void> {
    // Hash before the lookup so both branches take comparable time.
    const passwordHash = await this.passwords.hash(password);
    const existing = await this.users.findByEmail(email);

    if (existing?.emailVerifiedAt) {
      await this.sendEmail({
        to: existing.email,
        ...accountExistsEmail(`${this.appUrl}/login`),
      });
      return;
    }

    // An unverified account keeps its current password: the final one is chosen
    // when the link is used (see verifyEmail), so it cannot be pre-hijacked.
    if (existing) {
      await this.sendVerificationEmail(existing);
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

  /**
   * Proves control of the mailbox, sets the password typed on the verification
   * page and starts a session, so a password chosen by whoever registered the
   * address first never survives verification.
   */
  async verifyEmail({
    token,
    password,
  }: VerifyEmailInput): Promise<AuthenticatedSession> {
    const userId = await this.emailTokens.consume(
      token,
      EmailTokenType.VERIFY_EMAIL,
    );
    const passwordHash = await this.passwords.hash(password);
    const user = await this.users.setVerifiedPassword(userId, passwordHash);
    const tokens = await this.sessions.start(user.id);
    return { user: toAuthUser(user), tokens };
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

  /** Signs the visitor into a new, temporary demo account with example tables. */
  async startDemo(): Promise<AuthenticatedSession> {
    if (!this.demoEnabled) {
      throw new NotFoundException();
    }
    const user = await this.demo.createAccount();
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
    // Demo addresses are not real mailboxes.
    if (
      !user ||
      user.demoExpiresAt ||
      (await this.emailLimitReached(user, EmailTokenType.RESET_PASSWORD))
    ) {
      return;
    }
    const token = await this.emailTokens.issue(
      user.id,
      EmailTokenType.RESET_PASSWORD,
    );
    await this.sendEmail({
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
    // Also verifies the address (the reset email proves ownership) and logs out every session.
    await this.users.setVerifiedPassword(userId, passwordHash);
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    if (await this.emailLimitReached(user, EmailTokenType.VERIFY_EMAIL)) {
      return;
    }
    const token = await this.emailTokens.issue(
      user.id,
      EmailTokenType.VERIFY_EMAIL,
    );
    await this.sendEmail({
      to: user.email,
      ...verificationEmail(this.link('/verify-email', token)),
    });
  }

  /**
   * Delivery failures are logged instead of failing the request: these endpoints
   * must answer the same whether or not an account exists, and the user can
   * always ask for the email again.
   */
  private async sendEmail(message: MailMessage): Promise<void> {
    try {
      await this.mailer.send(message);
    } catch (error) {
      this.logger.error(
        `Failed to send "${message.subject}"`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** The caller answers as usual, so the limit reveals nothing about the account. */
  private async emailLimitReached(
    user: User,
    type: EmailTokenType,
  ): Promise<boolean> {
    const reached = await this.emailTokens.limitReached(user.id, type);
    if (reached) {
      this.logger.warn(
        `Email limit reached for user ${user.id} (${type}); not sending another`,
      );
    }
    return reached;
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
