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

// Empty counts as unset: Compose passes `KEY=` through when the value is missing.
const emptyAsUnset = (value: unknown) => (value === '' ? undefined : value);

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url(),
    CORS_ORIGINS: originList,
    // Number of reverse proxies in front of the API, so req.ip (used by the
    // rate limiter) is the client address instead of the proxy's.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    // Public URL of the frontend, used to build links in emails.
    APP_URL: z.url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    MAIL_FROM: z.string().min(1).default('WiseData <no-reply@wisedata.local>'),
    MAIL_TRANSPORT: z.enum(['smtp', 'resend']).default('smtp'),
    SMTP_HOST: z.string().min(1).default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    RESEND_API_KEY: z.preprocess(emptyAsUnset, z.string().min(1).optional()),
    // Secure session cookies; defaults to on in production. Turn off only to
    // serve over plain HTTP on a host other than localhost (e.g. a LAN server).
    COOKIE_SECURE: z.preprocess(
      emptyAsUnset,
      z
        .enum(['true', 'false'])
        .transform((value) => value === 'true')
        .optional(),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'Required when MAIL_TRANSPORT is "resend"',
      });
    }
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
