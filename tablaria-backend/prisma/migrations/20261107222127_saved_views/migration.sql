-- Saved views of a table: a named search, filters, sort and grouping (ADR-041).
-- CreateTable
CREATE TABLE "saved_views" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "createdById" UUID,
    "name" TEXT NOT NULL,
    "view" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_views_createdById_idx" ON "saved_views"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "saved_views_tableId_name_key" ON "saved_views"("tableId", "name");

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "inventory_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
