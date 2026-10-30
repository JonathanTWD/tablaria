import { validateEnv } from './env.schema';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/tablaria',
  CORS_ORIGINS: 'http://localhost:5173, https://app.example.com',
  APP_URL: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults and parses the origin list', () => {
    expect(validateEnv(validEnv)).toEqual({
      ...validEnv,
      NODE_ENV: 'development',
      PORT: 3000,
      TRUST_PROXY_HOPS: 0,
      CORS_ORIGINS: ['http://localhost:5173', 'https://app.example.com'],
      MAIL_FROM: 'Tablaria <no-reply@tablaria.local>',
      MAIL_TRANSPORT: 'smtp',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: 1025,
      DEMO_ENABLED: true,
    });
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({ ...validEnv, DATABASE_URL: undefined })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects invalid origins', () => {
    expect(() =>
      validateEnv({ ...validEnv, CORS_ORIGINS: 'not-a-url' }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('rejects origins with a path or trailing slash', () => {
    expect(() =>
      validateEnv({ ...validEnv, CORS_ORIGINS: 'https://app.example.com/' }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('rejects a short JWT secret', () => {
    expect(() =>
      validateEnv({ ...validEnv, JWT_ACCESS_SECRET: 'too-short' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('requires RESEND_API_KEY when sending through Resend', () => {
    expect(() =>
      validateEnv({ ...validEnv, MAIL_TRANSPORT: 'resend' }),
    ).toThrow(/RESEND_API_KEY/);
    expect(() =>
      validateEnv({
        ...validEnv,
        MAIL_TRANSPORT: 'resend',
        RESEND_API_KEY: '',
      }),
    ).toThrow(/RESEND_API_KEY/);
  });

  it('parses COOKIE_SECURE and leaves it unset when empty', () => {
    expect(validateEnv({ ...validEnv, COOKIE_SECURE: 'false' })).toHaveProperty(
      'COOKIE_SECURE',
      false,
    );
    expect(validateEnv({ ...validEnv, COOKIE_SECURE: '' }).COOKIE_SECURE).toBe(
      undefined,
    );
    expect(() => validateEnv({ ...validEnv, COOKIE_SECURE: 'yes' })).toThrow(
      /COOKIE_SECURE/,
    );
  });

  it('treats an empty RESEND_API_KEY as unset when using SMTP', () => {
    expect(validateEnv({ ...validEnv, RESEND_API_KEY: '' })).not.toHaveProperty(
      'RESEND_API_KEY',
      '',
    );
  });
});
