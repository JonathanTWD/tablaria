import { createTransport, type Transporter } from 'nodemailer';
import { Mailer, type MailMessage } from './mailer';

interface SmtpMailerOptions {
  host: string;
  port: number;
  from: string;
}

/** Plain SMTP without auth or TLS, intended for Mailpit in development and tests. */
export class SmtpMailer extends Mailer {
  private readonly transporter: Transporter;

  constructor(private readonly options: SmtpMailerOptions) {
    super();
    this.transporter = createTransport({
      host: options.host,
      port: options.port,
      secure: false,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.options.from, ...message });
  }
}
