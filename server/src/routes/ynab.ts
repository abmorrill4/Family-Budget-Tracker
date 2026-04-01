import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db";
import {
  validateToken,
  getBudgets,
  getAccounts,
} from "../lib/ynabClient";
import { syncYnabTransactions } from "../lib/ynabSync";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// ─── POST /api/ynab/validate — check if a token works ──────────────────────

router.post("/validate", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const valid = await validateToken(token);
    res.json({ valid });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/ynab/budgets — list budgets for a token ───────────────────────

router.get("/budgets", async (req, res, next) => {
  try {
    const token = req.headers["x-ynab-token"] as string;
    if (!token) throw new AppError(400, "x-ynab-token header required");
    const budgets = await getBudgets(token);
    res.json({ budgets });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/ynab/budgets/:budgetId/accounts — list accounts ──────────────

router.get("/budgets/:budgetId/accounts", async (req, res, next) => {
  try {
    const token = req.headers["x-ynab-token"] as string;
    if (!token) throw new AppError(400, "x-ynab-token header required");
    const accounts = await getAccounts(token, req.params.budgetId);
    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/ynab/connect — save a connection and do initial sync ─────────

const connectSchema = z.object({
  token: z.string().min(1),
  budgetId: z.string().min(1),
  budgetName: z.string().min(1),
  accountIds: z.array(z.string()).default([]),
  syncIntervalMinutes: z.number().min(15).max(1440).default(360),
});

router.post("/connect", async (req, res, next) => {
  try {
    const data = connectSchema.parse(req.body);

    // Validate the token first
    const valid = await validateToken(data.token);
    if (!valid) throw new AppError(400, "Invalid YNAB token");

    // Deactivate any existing connections (single-connection model)
    await prisma.ynabConnection.updateMany({
      where: { active: true },
      data: { active: false },
    });

    const connection = await prisma.ynabConnection.create({
      data: {
        accessToken: data.token,
        budgetId: data.budgetId,
        budgetName: data.budgetName,
        accountIds: data.accountIds,
        syncIntervalMinutes: data.syncIntervalMinutes,
      },
    });

    // Run initial sync
    const result = await syncYnabTransactions(connection.id);

    res.status(201).json({
      connection: serializeConnection(connection),
      sync: result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/ynab/sync — trigger manual sync ─────────────────────────────

router.post("/sync", async (req, res, next) => {
  try {
    const connection = await prisma.ynabConnection.findFirst({
      where: { active: true },
    });
    if (!connection) throw new AppError(404, "No active YNAB connection");

    const result = await syncYnabTransactions(connection.id);
    res.json({
      ...result,
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/ynab/status — get connection status ───────────────────────────

router.get("/status", async (_req, res, next) => {
  try {
    const connection = await prisma.ynabConnection.findFirst({
      where: { active: true },
    });

    if (!connection) {
      res.json({ connected: false });
      return;
    }

    const txnCount = await prisma.transaction.count({
      where: { source: "YNAB" },
    });

    res.json({
      connected: true,
      connection: serializeConnection(connection),
      transactionCount: txnCount,
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/ynab/settings — update sync interval or accounts ────────────

const settingsSchema = z.object({
  syncIntervalMinutes: z.number().min(15).max(1440).optional(),
  accountIds: z.array(z.string()).optional(),
});

router.patch("/settings", async (req, res, next) => {
  try {
    const data = settingsSchema.parse(req.body);
    const connection = await prisma.ynabConnection.findFirst({
      where: { active: true },
    });
    if (!connection) throw new AppError(404, "No active YNAB connection");

    const updated = await prisma.ynabConnection.update({
      where: { id: connection.id },
      data,
    });

    res.json({ connection: serializeConnection(updated) });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/ynab/disconnect — remove connection ────────────────────────

router.delete("/disconnect", async (_req, res, next) => {
  try {
    const connection = await prisma.ynabConnection.findFirst({
      where: { active: true },
    });
    if (!connection) throw new AppError(404, "No active YNAB connection");

    await prisma.ynabConnection.update({
      where: { id: connection.id },
      data: { active: false },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function serializeConnection(conn: {
  id: string;
  budgetId: string;
  budgetName: string;
  accountIds: string[];
  lastSyncedAt: Date | null;
  syncIntervalMinutes: number;
  active: boolean;
  createdAt: Date;
}) {
  return {
    id: conn.id,
    budgetId: conn.budgetId,
    budgetName: conn.budgetName,
    accountIds: conn.accountIds,
    lastSyncedAt: conn.lastSyncedAt?.toISOString() ?? null,
    syncIntervalMinutes: conn.syncIntervalMinutes,
    active: conn.active,
    createdAt: conn.createdAt.toISOString(),
  };
}

export default router;
