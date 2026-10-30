-- Tables move from a single owner to organizations (ADR-019). Every existing user
-- gets a personal organization holding the tables they owned, so nothing changes
-- for them.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('VIEWER', 'EDITOR', 'ADMIN', 'OWNER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "personalForId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("organizationId","userId")
);

-- CreateTable
CREATE TABLE "table_shares" (
    "tableId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_shares_pkey" PRIMARY KEY ("tableId","userId"),
    -- Sharing a single table never grants more than editing its records.
    CONSTRAINT "table_shares_role_check" CHECK ("role" IN ('VIEWER', 'EDITOR'))
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_personalForId_key" ON "organizations"("personalForId");

-- CreateIndex
CREATE INDEX "memberships_userId_idx" ON "memberships"("userId");

-- CreateIndex
CREATE INDEX "table_shares_userId_idx" ON "table_shares"("userId");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_personalForId_fkey" FOREIGN KEY ("personalForId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_shares" ADD CONSTRAINT "table_shares_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "inventory_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_shares" ADD CONSTRAINT "table_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: a personal organization, owned by its user, for every existing account.
INSERT INTO "organizations" ("id", "name", "personalForId", "updatedAt")
SELECT gen_random_uuid(), 'Personal', "id", CURRENT_TIMESTAMP FROM "users";

INSERT INTO "memberships" ("organizationId", "userId", "role")
SELECT "id", "personalForId", 'OWNER' FROM "organizations";

-- AlterTable: tables move to their owner's personal organization.
ALTER TABLE "inventory_tables" ADD COLUMN "organizationId" UUID,
ADD COLUMN "createdById" UUID;

UPDATE "inventory_tables" AS t
SET "organizationId" = o."id", "createdById" = t."ownerId"
FROM "organizations" AS o
WHERE o."personalForId" = t."ownerId";

ALTER TABLE "inventory_tables" ALTER COLUMN "organizationId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "inventory_tables" DROP CONSTRAINT "inventory_tables_ownerId_fkey";

-- DropIndex
DROP INDEX "inventory_tables_ownerId_updatedAt_idx";

ALTER TABLE "inventory_tables" DROP COLUMN "ownerId";

-- CreateIndex
CREATE INDEX "inventory_tables_organizationId_updatedAt_idx" ON "inventory_tables"("organizationId", "updatedAt");

-- AddForeignKey
ALTER TABLE "inventory_tables" ADD CONSTRAINT "inventory_tables_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_tables" ADD CONSTRAINT "inventory_tables_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
