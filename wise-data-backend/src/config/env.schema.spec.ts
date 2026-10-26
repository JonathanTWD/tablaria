import { validateEnv } from './env.schema';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5433/wisedata',
  CORS_ORIGINS: 'http://localhost:5173, https://app.example.com',
};

describe('validateEnv', () => {
  it('applies defaults and parses the origin list', () => {
    expect(validateEnv(validEnv)).toEqual({
      ...validEnv,
      NODE_ENV: 'development',
      PORT: 3000,
      TRUST_PROXY_HOPS: 0,
      CORS_ORIGINS: ['http://localhost:5173', 'https://app.example.com'],
    });
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({ CORS_ORIGINS: validEnv.CORS_ORIGINS })).toThrow(
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
});
