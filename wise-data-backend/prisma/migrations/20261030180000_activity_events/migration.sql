-- Activity history of each table (ADR-025).
-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED', 'RECORDS_IMPORTED', 'COLUMN_CREATED', 'COLUMN_UPDATED', 'COLUMN_DELETED', 'STOCK_MOVED');

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "userId" UUID,
    "action" "ActivityAction" NOT NULL,
    "recordId" UUID,
    "label" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_events_tableId_createdAt_idx" ON "activity_events"("tableId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_events_userId_idx" ON "activity_events"("userId");

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "inventory_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

