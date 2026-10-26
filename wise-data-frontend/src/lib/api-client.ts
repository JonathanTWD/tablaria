import type { ApiErrorBody } from "@wisedata/shared";

// Relative on purpose: the API is served from the same origin (Vite proxy in
// development, rewrite in production) so the httpOnly session cookies apply.
const API_BASE = "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Auth endpoints answer 401 for bad credentials; refreshing would be wrong there. */
  skipRefresh?: boolean;
}

function send(path: string, method: HttpMethod, body: unknown) {
  return fetch(`${API_BASE}${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let refreshInFlight: Promise<boolean> | null = null;

/** Renews the session once, shared by every request that hit a 401 at the same time. */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= send("/auth/refresh", "POST", undefined)
    // 409 means another tab refreshed first; the browser already has the new cookies.
    .then((response) => response.ok || response.status === 409)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  { method = "GET", body, skipRefresh = false }: RequestOptions = {},
): Promise<T> {
  let response = await send(path, method, body);

  if (response.status === 401 && !skipRefresh && (await refreshSession())) {
    response = await send(path, method, body);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorBody(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
