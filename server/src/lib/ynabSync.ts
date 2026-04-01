/**
 * YNAB sync service — maps YNAB transactions to local Transaction model
 * and upserts them. Supports delta sync via YNAB server_knowledge.
 */

import { TransactionType } from "@prisma/client";
import { prisma } from "./db";
import {
  getTransactions,
  getAccountTransactions,
  type YnabTransaction,
} from "./ynabClient";

// ─── Category → TransactionType mapping ──────────────────────────────────────

const INCOME_KEYWORDS = [
  "inflow",
  "income",
  "salary",
  "paycheck",
  "wage",
  "dividend",
  "interest earned",
  "refund",
  "reimbursement",
];

const BILL_KEYWORDS = [
  "rent",
  "mortgage",
  "electric",
  "gas",
  "water",
  "sewer",
  "internet",
  "phone",
  "insurance",
  "utility",
  "utilities",
];

const DEBT_KEYWORDS = [
  "loan",
  "credit card",
  "debt",
  "payment",
  "student loan",
  "car payment",
];

const SUBSCRIPTION_KEYWORDS = [
  "subscription",
  "netflix",
  "spotify",
  "hulu",
  "disney",
  "apple",
  "amazon prime",
  "youtube",
  "membership",
  "gym",
];

function categorizeTransaction(txn: YnabTransaction): TransactionType {
  // Positive amounts in YNAB are inflows
  if (txn.amount > 0) return "INCOME";

  const category = (txn.category_name ?? "").toLowerCase();
  const payee = (txn.payee_name ?? "").toLowerCase();
  const combined = `${category} ${payee}`;

  if (INCOME_KEYWORDS.some((k) => combined.includes(k))) return "INCOME";
  if (SUBSCRIPTION_KEYWORDS.some((k) => combined.includes(k)))
    return "SUBSCRIPTION";
  if (BILL_KEYWORDS.some((k) => combined.includes(k))) return "BILL";
  if (DEBT_KEYWORDS.some((k) => combined.includes(k))) return "DEBT";

  return "SPENDING";
}

// ─── Convert YNAB milliunits to dollars ──────────────────────────────────────

function milliunitsToDecimal(milliunits: number): number {
  return milliunits / 1000;
}

// ─── Build a display name from YNAB transaction ─────────────────────────────

function buildName(txn: YnabTransaction): string {
  const parts: string[] = [];
  if (txn.payee_name) parts.push(txn.payee_name);
  if (txn.category_name && txn.category_name !== "Uncategorized")
    parts.push(`[${txn.category_name}]`);
  return parts.join(" ") || "YNAB Transaction";
}

// ─── Sync result type ────────────────────────────────────────────────────────

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  serverKnowledge: number;
}

// ─── Main sync function ─────────────────────────────────────────────────────

export async function syncYnabTransactions(
  connectionId: string
): Promise<SyncResult> {
  const connection = await prisma.ynabConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) throw new Error("YNAB connection not found");
  if (!connection.active) throw new Error("YNAB connection is inactive");

  // Fetch transactions — use delta sync if we have prior server_knowledge
  let allYnabTxns: YnabTransaction[] = [];
  let serverKnowledge = 0;

  if (connection.accountIds.length > 0) {
    // Fetch per-account to filter to selected accounts only
    for (const accountId of connection.accountIds) {
      const resp = await getAccountTransactions(
        connection.accessToken,
        connection.budgetId,
        accountId,
        undefined,
        connection.lastServerKnowledge ?? undefined
      );
      allYnabTxns.push(...resp.transactions);
      serverKnowledge = Math.max(serverKnowledge, resp.server_knowledge);
    }
  } else {
    // Fetch all budget transactions
    const resp = await getTransactions(
      connection.accessToken,
      connection.budgetId,
      undefined,
      connection.lastServerKnowledge ?? undefined
    );
    allYnabTxns = resp.transactions;
    serverKnowledge = resp.server_knowledge;
  }

  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const txn of allYnabTxns) {
    // Handle deleted transactions
    if (txn.deleted) {
      const result = await prisma.transaction.deleteMany({
        where: { ynabId: txn.id },
      });
      deleted += result.count;
      continue;
    }

    const amount = milliunitsToDecimal(txn.amount);
    if (amount === 0) continue; // skip zero-amount transactions

    const data = {
      date: new Date(txn.date),
      type: categorizeTransaction(txn),
      name: buildName(txn),
      amount,
      reconciled: txn.cleared === "reconciled",
      notes: txn.memo,
      source: "YNAB" as const,
    };

    const existing = await prisma.transaction.findUnique({
      where: { ynabId: txn.id },
    });

    if (existing) {
      await prisma.transaction.update({
        where: { ynabId: txn.id },
        data,
      });
      updated++;
    } else {
      await prisma.transaction.create({
        data: { ...data, ynabId: txn.id },
      });
      created++;
    }
  }

  // Update connection with new sync metadata
  await prisma.ynabConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncedAt: new Date(),
      lastServerKnowledge: serverKnowledge,
    },
  });

  return { created, updated, deleted, serverKnowledge };
}

// ─── Sync all active connections ────────────────────────────────────────────

export async function syncAllActiveConnections(): Promise<void> {
  const connections = await prisma.ynabConnection.findMany({
    where: { active: true },
  });

  for (const conn of connections) {
    try {
      const result = await syncYnabTransactions(conn.id);
      console.log(
        `YNAB sync [${conn.budgetName}]: +${result.created} ~${result.updated} -${result.deleted}`
      );
    } catch (err) {
      console.error(`YNAB sync failed [${conn.budgetName}]:`, err);
    }
  }
}
