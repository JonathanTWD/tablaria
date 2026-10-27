const MAILPIT_API_URL = process.env.MAILPIT_API_URL ?? "http://127.0.0.1:8025/api/v1";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT_API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Mailpit ${path} responded with ${response.status}`);
  }
  return (await response.json()) as T;
}

/** Token from the latest email sent to `to`, waiting while Mailpit receives it. */
export async function latestEmailToken(to: string): Promise<string> {
  const query = encodeURIComponent(`to:"${to}"`);
  for (let attempt = 0; attempt < 50; attempt++) {
    const { messages } = await getJson<{ messages: { ID: string }[] }>(`/search?query=${query}`);
    if (messages[0]) {
      const { Text } = await getJson<{ Text: string }>(`/message/${messages[0].ID}`);
      const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(Text);
      if (!match) {
        throw new Error(`No token link in the email sent to ${to}`);
      }
      return match[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`No email received for ${to}`);
}
