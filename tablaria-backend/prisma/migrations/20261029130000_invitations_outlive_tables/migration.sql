-- Deleting a table must not erase its invitations: the per-recipient and
-- per-sender email limits count them, and deleting would reset those limits.
-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_tableId_fkey";

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "tableId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "inventory_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

