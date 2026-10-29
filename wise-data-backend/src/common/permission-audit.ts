import { Logger } from '@nestjs/common';

const logger = new Logger('PermissionAudit');

/**
 * Records who changed which access. Ids and roles only, never emails or names,
 * so the log holds no personal data and nothing a user typed (log injection).
 */
export function auditPermission(
  event: string,
  details: Record<string, string>,
): void {
  const fields = Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  logger.log(`${event} ${fields}`);
}
