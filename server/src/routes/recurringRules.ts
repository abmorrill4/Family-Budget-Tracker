import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/db";
import { createRecurringRuleSchema, updateRecurringRuleSchema } from "../lib/validations";
import { serializeRecurringRule } from "../lib/serialize";
import { AppError } from "../middleware/errorHandler";

const router = Router();

// GET /api/recurring-rules
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await prisma.recurringRule.findMany({
      orderBy: { createdAt: "asc" },
    });
    res.json({ data: rules.map(serializeRecurringRule) });
  } catch (err) {
    next(err);
  }
});

// POST /api/recurring-rules
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createRecurringRuleSchema.parse(req.body);
    const rule = await prisma.recurringRule.create({
      data: {
        name: data.name,
        amount: data.amount,
        type: data.type,
        frequency: data.frequency,
        anchorDays: data.anchorDays,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        notes: data.notes ?? null,
        active: data.active,
      },
    });
    res.status(201).json(serializeRecurringRule(rule));
  } catch (err) {
    next(err);
  }
});

// PUT /api/recurring-rules/:id
router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createRecurringRuleSchema.parse(req.body);
    const rule = await prisma.recurringRule.update({
      where: { id: req.params.id as string },
      data: {
        name: data.name,
        amount: data.amount,
        type: data.type,
        frequency: data.frequency,
        anchorDays: data.anchorDays,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        notes: data.notes ?? null,
        active: data.active,
      },
    });
    res.json(serializeRecurringRule(rule));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/recurring-rules/:id (partial update — active toggle etc.)
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateRecurringRuleSchema.parse(req.body);
    const updateData: Record<string, unknown> = {};
    if (data.active !== undefined) updateData.active = data.active;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.anchorDays !== undefined) updateData.anchorDays = data.anchorDays;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const rule = await prisma.recurringRule.update({
      where: { id: req.params.id as string },
      data: updateData,
    });
    res.json(serializeRecurringRule(rule));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/recurring-rules/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.recurringRule.delete({ where: { id: req.params.id as string } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/recurring-rules/:id/match — confirm a recurring rule match
router.post("/:id/match", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId, projectedDate } = req.body as {
      transactionId: string;
      projectedDate: string;
    };
    if (!transactionId || !projectedDate) {
      throw new AppError(400, "transactionId and projectedDate are required");
    }
    await prisma.$transaction([
      prisma.recurringRuleMatch.create({
        data: {
          ruleId: req.params.id as string,
          transactionId,
          projectedDate: new Date(projectedDate),
        },
      }),
      prisma.transaction.update({
        where: { id: transactionId },
        data: { reconciled: true },
      }),
    ]);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
