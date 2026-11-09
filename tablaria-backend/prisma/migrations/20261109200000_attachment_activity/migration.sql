-- Adding and removing attachments shows in the table's history (ADR-049).
-- AlterEnum
ALTER TYPE "ActivityAction" ADD VALUE 'ATTACHMENT_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE 'ATTACHMENT_REMOVED';
