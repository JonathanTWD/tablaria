/**
 * Uploads per user and minute. Checked before the body is read (app.setup),
 * since each one carries up to a whole file: the throttler guard runs after
 * the body parser and would only refuse a file already received.
 */
export const UPLOAD_LIMIT = 20;
export const UPLOAD_WINDOW_MS = 60_000;
