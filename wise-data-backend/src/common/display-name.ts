/**
 * How others see a person: the part of their email before the @, never the
 * whole address. Demo accounts stay anonymous.
 */
export function displayName(user: {
  email: string;
  demoExpiresAt: Date | null;
}): string | null {
  return user.demoExpiresAt ? null : user.email.split('@')[0];
}
