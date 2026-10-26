import { z } from 'zod';

const originList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(
        // Browsers send a bare origin, so entries with a path or trailing slash would never match.
        z
          .url()
          .refine((url) => URL.canParse(url) && new URL(url).origin === url, {
            message: 'Must be an origin like https://app.example.com',
          }),
      )
      .min(1),
  );

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  CORS_ORIGINS: originList,
  // Number of reverse proxies in front of the API, so req.ip (used by the
  // rate limiter) is the client address instead of the proxy's.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
