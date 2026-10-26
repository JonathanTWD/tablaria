import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.schema';
import { UsersModule } from '../users/users.module';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailTokenService } from './email-token.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailTokenService,
    PasswordService,
    SessionService,
    // Every route requires a valid access token unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
