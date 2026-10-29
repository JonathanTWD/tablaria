-- Invitations can also be to an organization (ADR-019).
-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "organizationId" UUID;

-- CreateIndex
CREATE INDEX "invitations_organizationId_idx" ON "invitations"("organizationId");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- At most one target (both become null once deleted), and table invitations
-- still grant no more than editing. Nobody is ever invited as an owner.
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_role_check";
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_one_target_check"
  CHECK ("tableId" IS NULL OR "organizationId" IS NULL);
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_check"
  CHECK ("role" <> 'OWNER' AND ("tableId" IS NULL OR "role" IN ('VIEWER', 'EDITOR')));
