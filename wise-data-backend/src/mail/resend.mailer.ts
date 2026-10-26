import { Mailer, type MailMessage } from './mailer';

const RESEND_API_URL = 'https://api.resend.com/emails';

interface ResendMailerOptions {
  apiKey: string;
  from: string;
}

/** Sends through Resend's HTTP API, since many hosts block outbound SMTP. */
export class ResendMailer extends Mailer {
  constructor(private readonly options: ResendMailerOptions) {
    super();
  }

  async send(message: MailMessage): Promise<void> {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.options.from, ...message }),
    });

    if (!response.ok) {
      throw new Error(
        `Resend responded with ${response.status}: ${await response.text()}`,
      );
    }
  }
}
