import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { Mailer } from './mailer';
import { ResendMailer } from './resend.mailer';
import { SmtpMailer } from './smtp.mailer';

@Global()
@Module({
  providers: [
    {
      provide: Mailer,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Mailer => {
        const from = config.get('MAIL_FROM', { infer: true });
        if (config.get('MAIL_TRANSPORT', { infer: true }) === 'resend') {
          // Presence is enforced by the env schema when the transport is "resend".
          const apiKey = config.get('RESEND_API_KEY', { infer: true }) ?? '';
          return new ResendMailer({ apiKey, from });
        }
        return new SmtpMailer({
          host: config.get('SMTP_HOST', { infer: true }),
          port: config.get('SMTP_PORT', { infer: true }),
          from,
        });
      },
    },
  ],
  exports: [Mailer],
})
export class MailModule {}
