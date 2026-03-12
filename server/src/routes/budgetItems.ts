import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/db";
import { createBudgetItemSchema, updateBudgetItemSchema } from "../lib/validations";
import { serializeBudgetItem } from "../lib/serialize";
import { AppError } from "../middleware/errorHandler";
import { Prisma } from "@prisma/client";

const router = Router();

// GET /api/budget-items — list with filters
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { start, end, type } = req.query as Record<string, string | undefined>;

    const where: Prisma.BudgetItemWhereInput = {};

    if (start || end) {
      where.date = {};
      if (start) where.date.gte = new Date(start);
      if (end) where.date.lte = new Date(end);
    }

    if (type) {
      where.type = type as Prisma.EnumTransactionTypeFilter["equals"];
    }

    const items = await prisma.budgetItem.findMany({
      where,
      orderBy: { date: "asc" },
    });

    res.json({ data: items.map(serializeBudgetItem) });
  } catch (err) {
    next(err);
  }
});

// POST /api/budget-items — create
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createBudgetItemSchema.parse(req.body);
    const item = await prisma.budgetItem.create({
      data: {
        date: new Date(data.date),
        type: data.type,
        name: data.name,
        amount: data.amount,
        notes: data.notes ?? null,
      },
    });
    res.status(201).json(serializeBudgetItem(item));
  } catch (err) {
    next(err);
  }
});

// PUT /api/budget-items/:id — update
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateBudgetItemSchema.parse(req.body);
    const existing = await prisma.budgetItem.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new AppError(404, "Budget item not found");

    const updateData: Prisma.BudgetItemUpdateInput = {};
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const item = await prisma.budgetItem.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(serializeBudgetItem(item));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/budget-items/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.budgetItem.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
