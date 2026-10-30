-- Read-only public links to a table (ADR-026).
-- CreateTable
CREATE TABLE "public_links" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_links_tableId_key" ON "public_links"("tableId");

-- CreateIndex
CREATE UNIQUE INDEX "public_links_tokenHash_key" ON "public_links"("tokenHash");

-- CreateIndex
CREATE INDEX "public_links_createdById_idx" ON "public_links"("createdById");

-- AddForeignKey
ALTER TABLE "public_links" ADD CONSTRAINT "public_links_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "inventory_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_links" ADD CONSTRAINT "public_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

