/*
  Warnings:

  - You are about to drop the column `projectedDate` on the `recurring_rule_matches` table. All the data in the column will be lost.
  - You are about to drop the column `ruleId` on the `recurring_rule_matches` table. All the data in the column will be lost.
  - You are about to drop the column `transactionId` on the `recurring_rule_matches` table. All the data in the column will be lost.
  - You are about to drop the column `anchorDays` on the `recurring_rules` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `recurring_rules` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `recurring_rules` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[rule_id,projected_date]` on the table `recurring_rule_matches` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `projected_date` to the `recurring_rule_matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rule_id` to the `recurring_rule_matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transaction_id` to the `recurring_rule_matches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_date` to the `recurring_rules` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "recurring_rule_matches" DROP CONSTRAINT "recurring_rule_matches_ruleId_fkey";

-- DropForeignKey
ALTER TABLE "recurring_rule_matches" DROP CONSTRAINT "recurring_rule_matches_transactionId_fkey";

-- DropIndex
DROP INDEX "recurring_rule_matches_ruleId_projectedDate_key";

-- AlterTable
ALTER TABLE "recurring_rule_matches" DROP COLUMN "projectedDate",
DROP COLUMN "ruleId",
DROP COLUMN "transactionId",
ADD COLUMN     "projected_date" DATE NOT NULL,
ADD COLUMN     "rule_id" UUID NOT NULL,
ADD COLUMN     "transaction_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "recurring_rules" DROP COLUMN "anchorDays",
DROP COLUMN "endDate",
DROP COLUMN "startDate",
ADD COLUMN     "anchor_days" INTEGER[],
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "start_date" DATE NOT NULL;

-- CreateIndex
CREATE INDEX "recurring_rule_matches_transaction_id_idx" ON "recurring_rule_matches"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_rule_matches_rule_id_projected_date_key" ON "recurring_rule_matches"("rule_id", "projected_date");

-- AddForeignKey
ALTER TABLE "recurring_rule_matches" ADD CONSTRAINT "recurring_rule_matches_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "recurring_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rule_matches" ADD CONSTRAINT "recurring_rule_matches_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
