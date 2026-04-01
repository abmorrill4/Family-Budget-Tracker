-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'YNAB');

-- AlterTable: add source and ynab_id to transactions
ALTER TABLE "transactions" ADD COLUMN "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "transactions" ADD COLUMN "ynab_id" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_ynab_id_key" ON "transactions"("ynab_id");
CREATE INDEX "transactions_ynab_id_idx" ON "transactions"("ynab_id");

-- CreateTable
CREATE TABLE "ynab_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "access_token" TEXT NOT NULL,
    "budget_id" VARCHAR(255) NOT NULL,
    "budget_name" VARCHAR(255) NOT NULL,
    "account_ids" TEXT[],
    "last_synced_at" TIMESTAMPTZ,
    "last_server_knowledge" INTEGER,
    "sync_interval_minutes" INTEGER NOT NULL DEFAULT 360,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ynab_connections_pkey" PRIMARY KEY ("id")
);
