import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const transactionTypeEnum = z.enum([
  "INCOME",
  "BILL",
  "DEBT",
  "SPENDING",
  "SUBSCRIPTION",
]);

export const createTransactionSchema = z.object({
  date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD format"),
  type: transactionTypeEnum,
  name: z.string().min(1, "Name is required").max(255),
  amount: z.number().refine((v) => v !== 0, "Amount must be non-zero"),
  reconciled: z.boolean().optional().default(false),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateTransactionSchema = z.object({
  date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD format").optional(),
  type: transactionTypeEnum.optional(),
  name: z.string().min(1).max(255).optional(),
  amount: z.number().refine((v) => v !== 0, "Amount must be non-zero").optional(),
  reconciled: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const createBudgetItemSchema = z.object({
  date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD format"),
  type: transactionTypeEnum,
  name: z.string().min(1, "Name is required").max(255),
  amount: z.number().refine((v) => v !== 0, "Amount must be non-zero"),
  notes: z.string().max(1000).nullable().optional(),
});

export const updateBudgetItemSchema = z.object({
  date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD format").optional(),
  type: transactionTypeEnum.optional(),
  name: z.string().min(1).max(255).optional(),
  amount: z.number().refine((v) => v !== 0, "Amount must be non-zero").optional(),
  notes: z.string().max(1000).nullable().optional(),
});

const recurringFrequencyEnum = z.enum([
  "WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY", "QUARTERLY", "YEARLY",
]);

export const createRecurringRuleSchema = z.object({
  name: z.string().min(1).max(255),
  amount: z.number().refine((v) => v !== 0, "Amount must be non-zero"),
  type: transactionTypeEnum,
  frequency: recurringFrequencyEnum,
  anchorDays: z.array(z.number().int().min(0).max(31)).default([]),
  startDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD format"),
  endDate: z.string().regex(dateRegex).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const updateRecurringRuleSchema = createRecurringRuleSchema.partial();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type CreateBudgetItemInput = z.infer<typeof createBudgetItemSchema>;
export type UpdateBudgetItemInput = z.infer<typeof updateBudgetItemSchema>;
export type CreateRecurringRuleInput = z.infer<typeof createRecurringRuleSchema>;
export type UpdateRecurringRuleInput = z.infer<typeof updateRecurringRuleSchema>;
