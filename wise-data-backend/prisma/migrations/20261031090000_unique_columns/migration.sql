-- Columns whose values identify a record, like a SKU (ADR-023).
ALTER TABLE "columns" ADD COLUMN "unique" BOOLEAN NOT NULL DEFAULT false;
