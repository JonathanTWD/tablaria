import { API_PREFIX } from '../common/api-prefix';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_REUSE_GRACE_MS = 30_000;

export const ACCESS_COOKIE = 'wd_access';
export const REFRESH_COOKIE = 'wd_refresh';
export const ACCESS_COOKIE_PATH = `/${API_PREFIX}`;
// The refresh token is only sent to /api/auth (refresh and logout), never to data endpoints.
export const REFRESH_COOKIE_PATH = `/${API_PREFIX}/auth`;

const ONE_MINUTE_MS = 60_000;

/** Strict limit for endpoints that check credentials or send emails. */
export const SENSITIVE_THROTTLE = {
  default: { limit: 5, ttl: ONE_MINUTE_MS },
};

/** Each demo creates an account and three tables, so it is the tightest limit. */
export const DEMO_THROTTLE = {
  default: { limit: 3, ttl: ONE_MINUTE_MS },
};

export const REFRESH_THROTTLE = {
  default: { limit: 30, ttl: ONE_MINUTE_MS },
};
