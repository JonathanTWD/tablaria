export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Transport-agnostic email sender; the implementation is chosen by MAIL_TRANSPORT. */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}
