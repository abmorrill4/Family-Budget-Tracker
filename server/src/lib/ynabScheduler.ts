/**
 * Simple interval-based scheduler for YNAB auto-sync.
 * Checks active connections and syncs those past their interval.
 */

import { prisma } from "./db";
import { syncYnabTransactions } from "./ynabSync";

let intervalId: ReturnType<typeof setInterval> | null = null;

const CHECK_INTERVAL_MS = 60_000; // check every minute

async function tick() {
  try {
    const connections = await prisma.ynabConnection.findMany({
      where: { active: true },
    });

    const now = Date.now();

    for (const conn of connections) {
      const lastSync = conn.lastSyncedAt?.getTime() ?? 0;
      const intervalMs = conn.syncIntervalMinutes * 60_000;

      if (now - lastSync >= intervalMs) {
        try {
          const result = await syncYnabTransactions(conn.id);
          console.log(
            `[auto-sync] ${conn.budgetName}: +${result.created} ~${result.updated} -${result.deleted}`
          );
        } catch (err) {
          console.error(`[auto-sync] ${conn.budgetName} failed:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[auto-sync] scheduler tick failed:", err);
  }
}

export function startScheduler() {
  if (intervalId) return;
  console.log("YNAB auto-sync scheduler started");
  intervalId = setInterval(tick, CHECK_INTERVAL_MS);
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("YNAB auto-sync scheduler stopped");
  }
}
