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
  endDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD format").nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  active: z.boolean().optional().default(true),
}).superRefine((data, ctx) => {
  // Validate anchorDays range per frequency
  if (data.frequency === "WEEKLY" || data.frequency === "BIWEEKLY") {
    for (const d of data.anchorDays) {
      if (d < 0 || d > 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["anchorDays"],
          message: "anchorDays must be 0–6 (day of week) for WEEKLY/BIWEEKLY frequency",
        });
        break;
      }
    }
  } else if (["MONTHLY", "SEMIMONTHLY", "QUARTERLY"].includes(data.frequency)) {
    for (const d of data.anchorDays) {
      if (d < 1 || d > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["anchorDays"],
          message: "anchorDays must be 1–31 for this frequency",
        });
        break;
      }
    }
  }

  // Validate endDate >= startDate
  if (data.endDate && data.startDate && data.endDate < data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "endDate must be on or after startDate",
    });
  }
});

export const updateRecurringRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  amount: z.number().refine((v) => v !== 0, "Amount must be non-zero").optional(),
  type: transactionTypeEnum.optional(),
  frequency: recurringFrequencyEnum.optional(),
  anchorDays: z.array(z.number().int().min(0).max(31)).optional(),
  startDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD format").optional(),
  endDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD format").nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  active: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.frequency && (data.frequency === "WEEKLY" || data.frequency === "BIWEEKLY") && data.anchorDays) {
    for (const d of data.anchorDays) {
      if (d < 0 || d > 6) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["anchorDays"], message: "anchorDays must be 0–6 for WEEKLY/BIWEEKLY frequency" });
        break;
      }
    }
  } else if (data.frequency && ["MONTHLY", "SEMIMONTHLY", "QUARTERLY"].includes(data.frequency) && data.anchorDays) {
    for (const d of data.anchorDays) {
      if (d < 1 || d > 31) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["anchorDays"], message: "anchorDays must be 1–31 for this frequency" });
        break;
      }
    }
  }
  if (data.endDate && data.startDate && data.endDate < data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate must be on or after startDate" });
  }
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type CreateBudgetItemInput = z.infer<typeof createBudgetItemSchema>;
export type UpdateBudgetItemInput = z.infer<typeof updateBudgetItemSchema>;
export type CreateRecurringRuleInput = z.infer<typeof createRecurringRuleSchema>;
export type UpdateRecurringRuleInput = z.infer<typeof updateRecurringRuleSchema>;
