-- Emailed invitations to share a table (ADR-019).
-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id"),
    -- Invitations are to a single table, which never grants more than editing.
    CONSTRAINT "invitations_role_check" CHECK ("role" IN ('VIEWER', 'EDITOR'))
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_tableId_idx" ON "invitations"("tableId");

-- CreateIndex
CREATE INDEX "invitations_email_createdAt_idx" ON "invitations"("email", "createdAt");

-- CreateIndex
CREATE INDEX "invitations_invitedById_createdAt_idx" ON "invitations"("invitedById", "createdAt");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "inventory_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

