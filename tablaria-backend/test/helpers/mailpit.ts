const MAILPIT_API_URL =
  process.env.MAILPIT_API_URL ?? 'http://127.0.0.1:8025/api/v1';

interface MailpitSummary {
  ID: string;
  Subject: string;
}

interface MailpitMessage {
  Subject: string;
  Text: string;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT_API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Mailpit ${path} responded with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function listEmails(to: string): Promise<MailpitSummary[]> {
  const query = encodeURIComponent(`to:"${to}"`);
  const { messages } = await getJson<{ messages: MailpitSummary[] }>(
    `/search?query=${query}`,
  );
  return messages;
}

/** Latest email sent to `to`, retrying briefly while Mailpit indexes it. */
export async function latestEmail(to: string): Promise<MailpitMessage> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const [latest] = await listEmails(to);
    if (latest) {
      return getJson<MailpitMessage>(`/message/${latest.ID}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No email received for ${to}`);
}

export function extractToken(email: MailpitMessage): string {
  const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(email.Text);
  if (!match) {
    throw new Error(`No token link in email "${email.Subject}"`);
  }
  return match[1];
}
