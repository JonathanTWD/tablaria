-- Demo accounts: deleted with all their data once this date passes.
ALTER TABLE "users" ADD COLUMN "demoExpiresAt" TIMESTAMP(3);

CREATE INDEX "users_demoExpiresAt_idx" ON "users"("demoExpiresAt");
