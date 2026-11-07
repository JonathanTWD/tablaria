/** A tool the model may call, as the OpenAI-compatible chat API describes it. */
export interface ChatTool {
  type: 'function';
  function: { name: string; description: string; parameters: object };
}

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ChatCompletion {
  content: string | null;
  toolCalls: ChatToolCall[];
}

/** The provider is over its rate limit, or unreachable: try again later. */
export class ModelUnavailableError extends Error {}

export interface ChatModelSettings {
  apiKey?: string;
  baseUrl: string;
  model: string;
}

/** Long enough for a slow answer, short enough not to hold the request forever. */
const TIMEOUT_MS = 30_000;
/** Answers are a few sentences: this keeps the free plan's token budget (ADR-042). */
const MAX_ANSWER_TOKENS = 700;

/**
 * Any OpenAI-compatible chat completions API (Groq by default, ADR-042).
 * Tests replace `complete` with a script, so they never reach a provider.
 */
export class ChatModel {
  readonly enabled: boolean;

  constructor(private readonly settings: ChatModelSettings) {
    this.enabled = Boolean(settings.apiKey);
  }

  /** With no `tools`, the model can only answer in words. */
  async complete(
    messages: ChatMessage[],
    tools: ChatTool[],
  ): Promise<ChatCompletion> {
    let response: Response;
    try {
      response = await fetch(
        `${this.settings.baseUrl.replace(/\/+$/, '')}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.settings.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.settings.model,
            messages,
            ...(tools.length > 0 && { tools, tool_choice: 'auto' }),
            temperature: 0.2,
            max_completion_tokens: MAX_ANSWER_TOKENS,
            // gpt-oss models think before answering; a little is enough here.
            ...(this.settings.model.startsWith('openai/gpt-oss') && {
              reasoning_effort: 'low',
            }),
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
    } catch (error) {
      throw new ModelUnavailableError(
        `Model request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (response.status === 429 || response.status >= 500) {
      throw new ModelUnavailableError(`Model answered ${response.status}`);
    }
    if (!response.ok) {
      // The body explains the error; it holds no secrets, but is not shown to users.
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      throw new Error(`Model answered ${response.status}: ${detail}`);
    }
    const body = (await response.json()) as {
      choices?: {
        message?: { content?: string | null; tool_calls?: ChatToolCall[] };
      }[];
    };
    const message = body.choices?.[0]?.message;
    return {
      content: message?.content ?? null,
      toolCalls: message?.tool_calls ?? [],
    };
  }
}
