import type { ApiErrorBody } from "@tablaria/shared";

// Relative on purpose: the API is served from the same origin (Vite proxy in
// development, rewrite in production) so the httpOnly session cookies apply.
const API_BASE = "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;
  /** True when a protected request stayed 401 after trying to refresh: the session is gone. */
  readonly sessionExpired: boolean;

  constructor(status: number, body: ApiErrorBody | null, sessionExpired = false) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.sessionExpired = sessionExpired;
  }
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Auth endpoints answer 401 for bad credentials; refreshing would be wrong there. */
  skipRefresh?: boolean;
  headers?: Record<string, string>;
}

function send(path: string, method: HttpMethod, body: unknown, headers: Record<string, string> = {}) {
  // A file goes as it is: the API reads uploads as the raw body (ADR-039).
  if (body instanceof Blob) {
    return fetch(`${API_BASE}${path}`, {
      method,
      credentials: "same-origin",
      headers: { ...headers, "Content-Type": body.type || "application/octet-stream" },
      body,
    });
  }
  return fetch(`${API_BASE}${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? headers : { ...headers, "Content-Type": "application/json" },
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

/** Sends the request, refreshing the session once on a 401, and throws ApiError unless it succeeds. */
async function fetchWithSession(
  path: string,
  { method = "GET", body, skipRefresh = false, headers }: RequestOptions = {},
): Promise<Response> {
  let response = await send(path, method, body, headers);

  if (response.status === 401 && !skipRefresh && (await refreshSession())) {
    response = await send(path, method, body, headers);
  }

  if (!response.ok) {
    const sessionExpired = response.status === 401 && !skipRefresh;
    throw new ApiError(response.status, await readErrorBody(response), sessionExpired);
  }
  return response;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetchWithSession(path, options);
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Downloads a file from the API and saves it under the name the API suggests. */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const response = await fetchWithSession(path);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  // Firefox ignores clicks on detached links, and revoking the URL in the same
  // tick can cancel the download in Firefox and Safari.
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url));
}
