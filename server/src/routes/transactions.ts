import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/db";
import { createTransactionSchema, updateTransactionSchema } from "../lib/validations";
import { computeMonthMetrics } from "../lib/calculations";
import { serializeTransaction } from "../lib/serialize";
import { AppError } from "../middleware/errorHandler";
import { Prisma } from "@prisma/client";
import { expandRules, RuleInput } from "../lib/recurringExpansion";

const router = Router();

// GET /api/transactions — list with filters + pagination
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      start,
      end,
      type,
      reconciled,
      search,
      page: pageStr = "1",
      limit: limitStr = "50",
    } = req.query as Record<string, string | undefined>;

    const page = Math.max(1, parseInt(pageStr || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(limitStr || "50", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};

    if (start || end) {
      where.date = {};
      if (start) where.date.gte = new Date(start);
      if (end) where.date.lte = new Date(end);
    }

    if (type) {
      where.type = type as Prisma.EnumTransactionTypeFilter["equals"];
    }

    if (reconciled === "true") where.reconciled = true;
    if (reconciled === "false") where.reconciled = false;

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data: transactions.map(serializeTransaction),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/transactions — create
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createTransactionSchema.parse(req.body);
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(data.date),
        type: data.type,
        name: data.name,
        amount: data.amount,
        reconciled: data.reconciled,
        notes: data.notes ?? null,
      },
    });
    res.status(201).json(serializeTransaction(transaction));
  } catch (err) {
    next(err);
  }
});

// GET /api/transactions/calendar — MUST be before /:id
router.get("/calendar", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = parseInt(req.query.year as string, 10);
    const month = parseInt(req.query.month as string, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new AppError(400, "Valid year and month (1-12) are required");
    }

    const lastDay = new Date(year, month, 0);
    const rangeStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const rangeEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

    // Fetch real transactions (all history through end of requested month)
    const transactions = await prisma.transaction.findMany({
      where: { date: { lte: lastDay } },
      orderBy: { date: "asc" },
      select: { date: true, amount: true },
    });

    // Fetch active recurring rules and expand into projected occurrences
    const rules = await prisma.recurringRule.findMany({ where: { active: true } });
    const ruleInputs: RuleInput[] = rules.map((r) => ({
      id: r.id,
      name: r.name,
      amount: r.amount.toNumber(),
      type: r.type,
      frequency: r.frequency as RuleInput["frequency"],
      anchorDays: r.anchorDays,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
      active: r.active,
    }));

    const projected = expandRules(ruleInputs, rangeStart, rangeEnd);

    // Merge real + projected for metric computation
    const txnInputs = [
      ...transactions.map((t) => ({
        date: t.date.toISOString().slice(0, 10),
        amount: t.amount.toNumber(),
      })),
      ...projected.map((p) => ({ date: p.date, amount: p.amount })),
    ];

    const days = computeMonthMetrics(year, month, txnInputs);

    // Return projected occurrences for just the requested month so the UI can render them distinctly
    const monthStr = `${year}-${String(month).padStart(2, "0")}`;
    const monthProjected = projected.filter((p) => p.date.startsWith(monthStr));

    res.json({ year, month, days, projected: monthProjected });
  } catch (err) {
    next(err);
  }
});

// GET /api/transactions/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.id },
    });
    if (!transaction) throw new AppError(404, "Transaction not found");
    res.json(serializeTransaction(transaction));
  } catch (err) {
    next(err);
  }
});

// PUT /api/transactions/:id — full update
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createTransactionSchema.parse(req.body);
    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: {
        date: new Date(data.date),
        type: data.type,
        name: data.name,
        amount: data.amount,
        reconciled: data.reconciled,
        notes: data.notes ?? null,
      },
    });
    res.json(serializeTransaction(transaction));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/transactions/:id — partial update (reconcile toggle)
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateTransactionSchema.parse(req.body);
    const updateData: Prisma.TransactionUpdateInput = {};

    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.reconciled !== undefined) updateData.reconciled = data.reconciled;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(serializeTransaction(transaction));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/transactions/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.transaction.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
