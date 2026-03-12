# Recurring Transactions & Forecasting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add recurring income/expense rules that project forward into the calendar view and auto-match against imported bank ledger transactions for reconciliation.

**Architecture:** Store recurring rules in a new `RecurringRule` DB table. Expand rules into projected `{ date, amount }` occurrences server-side at calendar query time, merging them with real transactions before computing metrics. A separate auto-match endpoint identifies likely ledger↔projection pairings for the user to confirm.

**Tech Stack:** Prisma (PostgreSQL), Express/TypeScript, Zod, React, TanStack Query, Zustand, shadcn/ui, Tailwind CSS

---

## Task 1: Prisma Schema — Add RecurringRule and RecurringRuleMatch

**Files:**
- Modify: `server/prisma/schema.prisma`

**Step 1: Add the two new models to schema.prisma**

Add after the `BudgetItem` model:

```prisma
enum RecurringFrequency {
  WEEKLY
  BIWEEKLY
  SEMIMONTHLY
  MONTHLY
  QUARTERLY
  YEARLY
}

model RecurringRule {
  id          String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String             @db.VarChar(255)
  amount      Decimal            @db.Decimal(12, 2)
  type        TransactionType
  frequency   RecurringFrequency
  anchorDays  Int[]
  startDate   DateTime           @db.Date
  endDate     DateTime?          @db.Date
  notes       String?            @db.Text
  active      Boolean            @default(true)
  createdAt   DateTime           @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt   DateTime           @updatedAt @map("updated_at") @db.Timestamptz()
  matches     RecurringRuleMatch[]

  @@map("recurring_rules")
}

model RecurringRuleMatch {
  id             String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ruleId         String        @db.Uuid
  transactionId  String        @db.Uuid
  projectedDate  DateTime      @db.Date
  createdAt      DateTime      @default(now()) @map("created_at") @db.Timestamptz()

  rule        RecurringRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  transaction Transaction   @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  @@unique([ruleId, projectedDate])
  @@map("recurring_rule_matches")
}
```

Also add `matches RecurringRuleMatch[]` to the `Transaction` model.

**Step 2: Create and apply migration**

```bash
cd server
npx prisma migrate dev --name add_recurring_rules
```

Expected: Migration created and applied, Prisma client regenerated.

**Step 3: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat: add RecurringRule and RecurringRuleMatch schema"
```

---

## Task 2: Server — Recurring Rule Expansion Logic (Pure Function + Tests)

**Files:**
- Create: `server/src/lib/recurringExpansion.ts`
- Create: `server/src/lib/recurringExpansion.test.ts`

**Step 1: Install test dependencies**

```bash
cd server
npm install --save-dev jest ts-jest @types/jest
```

Add to `server/package.json` scripts:
```json
"test": "jest"
```

Add jest config to `server/package.json`:
```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node"
}
```

**Step 2: Write failing tests first**

Create `server/src/lib/recurringExpansion.test.ts`:

```typescript
import { expandRule } from "./recurringExpansion";

const base = {
  id: "1",
  name: "Test",
  amount: -100,
  type: "BILL" as const,
  anchorDays: [] as number[],
  active: true,
  endDate: null,
};

describe("expandRule - MONTHLY", () => {
  it("generates one occurrence per month on the anchor day", () => {
    const rule = { ...base, frequency: "MONTHLY" as const, anchorDays: [15], startDate: "2026-01-01" };
    const results = expandRule(rule, "2026-01-01", "2026-03-31");
    expect(results.map(r => r.date)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
    expect(results[0].amount).toBe(-100);
    expect(results[0].projected).toBe(true);
  });

  it("does not generate before startDate", () => {
    const rule = { ...base, frequency: "MONTHLY" as const, anchorDays: [1], startDate: "2026-02-01" };
    const results = expandRule(rule, "2026-01-01", "2026-03-31");
    expect(results.map(r => r.date)).toEqual(["2026-02-01", "2026-03-01"]);
  });

  it("does not generate after endDate", () => {
    const rule = { ...base, frequency: "MONTHLY" as const, anchorDays: [1], startDate: "2026-01-01", endDate: "2026-02-15" };
    const results = expandRule(rule, "2026-01-01", "2026-03-31");
    expect(results.map(r => r.date)).toEqual(["2026-01-01", "2026-02-01"]);
  });
});

describe("expandRule - SEMIMONTHLY", () => {
  it("generates two occurrences per month", () => {
    const rule = { ...base, frequency: "SEMIMONTHLY" as const, anchorDays: [1, 15], startDate: "2026-01-01" };
    const results = expandRule(rule, "2026-01-01", "2026-01-31");
    expect(results.map(r => r.date)).toEqual(["2026-01-01", "2026-01-15"]);
  });
});

describe("expandRule - QUARTERLY", () => {
  it("generates every 3 months from start month", () => {
    const rule = { ...base, frequency: "QUARTERLY" as const, anchorDays: [1], startDate: "2026-01-01" };
    const results = expandRule(rule, "2026-01-01", "2026-12-31");
    expect(results.map(r => r.date)).toEqual(["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"]);
  });
});

describe("expandRule - WEEKLY", () => {
  it("generates every 7 days on the specified day of week", () => {
    // 2026-03-09 is a Monday (dayOfWeek=1)
    const rule = { ...base, frequency: "WEEKLY" as const, anchorDays: [1], startDate: "2026-03-09" };
    const results = expandRule(rule, "2026-03-09", "2026-03-30");
    expect(results.map(r => r.date)).toEqual(["2026-03-09", "2026-03-16", "2026-03-23", "2026-03-30"]);
  });
});

describe("expandRule - BIWEEKLY", () => {
  it("generates every 14 days anchored from startDate", () => {
    const rule = { ...base, frequency: "BIWEEKLY" as const, anchorDays: [1], startDate: "2026-03-09" };
    const results = expandRule(rule, "2026-03-09", "2026-04-06");
    expect(results.map(r => r.date)).toEqual(["2026-03-09", "2026-03-23", "2026-04-06"]);
  });
});

describe("expandRule - YEARLY", () => {
  it("generates once per year on startDate month+day", () => {
    const rule = { ...base, frequency: "YEARLY" as const, anchorDays: [], startDate: "2026-03-15" };
    const results = expandRule(rule, "2026-01-01", "2028-12-31");
    expect(results.map(r => r.date)).toEqual(["2026-03-15", "2027-03-15", "2028-03-15"]);
  });
});
```

**Step 3: Run tests to verify they fail**

```bash
cd server && npx jest src/lib/recurringExpansion.test.ts
```

Expected: FAIL — "Cannot find module './recurringExpansion'"

**Step 4: Implement `server/src/lib/recurringExpansion.ts`**

```typescript
export type RecurringFrequency =
  | "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY"
  | "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface RuleInput {
  id: string;
  name: string;
  amount: number;
  type: string;
  frequency: RecurringFrequency;
  anchorDays: number[];
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  active: boolean;
}

export interface ProjectedOccurrence {
  date: string; // YYYY-MM-DD
  amount: number;
  projected: true;
  ruleId: string;
  ruleName: string;
  type: string;
}

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function clamp(day: number, daysInMonth: number): number {
  return Math.min(day, daysInMonth);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function expandRule(
  rule: RuleInput,
  rangeStart: string,
  rangeEnd: string
): ProjectedOccurrence[] {
  if (!rule.active) return [];

  const results: ProjectedOccurrence[] = [];
  const rStart = new Date(rangeStart + "T00:00:00Z");
  const rEnd = new Date(rangeEnd + "T00:00:00Z");
  const sDate = new Date(rule.startDate + "T00:00:00Z");
  const eDate = rule.endDate ? new Date(rule.endDate + "T00:00:00Z") : null;

  const effectiveStart = sDate > rStart ? sDate : rStart;
  const effectiveEnd = eDate && eDate < rEnd ? eDate : rEnd;

  function emit(dateStr: string) {
    if (dateStr >= toYMD(effectiveStart) && dateStr <= toYMD(effectiveEnd)) {
      results.push({
        date: dateStr,
        amount: rule.amount,
        projected: true,
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
      });
    }
  }

  if (rule.frequency === "MONTHLY" || rule.frequency === "SEMIMONTHLY") {
    const startYear = rStart.getUTCFullYear();
    const startMonth = rStart.getUTCMonth() + 1;
    const endYear = rEnd.getUTCFullYear();
    const endMonth = rEnd.getUTCMonth() + 1;

    for (let y = startYear; y <= endYear; y++) {
      const mStart = y === startYear ? startMonth : 1;
      const mEnd = y === endYear ? endMonth : 12;
      for (let m = mStart; m <= mEnd; m++) {
        const dim = daysInMonth(y, m);
        for (const day of rule.anchorDays) {
          const d = clamp(day, dim);
          emit(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
        }
      }
    }
  } else if (rule.frequency === "QUARTERLY") {
    const startYear = sDate.getUTCFullYear();
    const startMonth = sDate.getUTCMonth() + 1;
    const day = rule.anchorDays[0] ?? 1;

    let y = startYear;
    let m = startMonth;
    while (true) {
      const dim = daysInMonth(y, m);
      const d = clamp(day, dim);
      const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (dateStr > toYMD(rEnd)) break;
      emit(dateStr);
      m += 3;
      if (m > 12) { m -= 12; y++; }
    }
  } else if (rule.frequency === "WEEKLY") {
    const targetDow = rule.anchorDays[0] ?? 0; // 0=Sunday
    // Find first occurrence >= effectiveStart on targetDow
    const cur = new Date(effectiveStart);
    while (cur.getUTCDay() !== targetDow) cur.setUTCDate(cur.getUTCDate() + 1);
    while (cur <= effectiveEnd) {
      emit(toYMD(cur));
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
  } else if (rule.frequency === "BIWEEKLY") {
    // Anchor from startDate, step 14 days
    const cur = new Date(sDate);
    while (cur < effectiveStart) cur.setUTCDate(cur.getUTCDate() + 14);
    while (cur <= effectiveEnd) {
      emit(toYMD(cur));
      cur.setUTCDate(cur.getUTCDate() + 14);
    }
  } else if (rule.frequency === "YEARLY") {
    const month = sDate.getUTCMonth() + 1;
    const day = sDate.getUTCDate();
    const startYear = rStart.getUTCFullYear();
    const endYear = rEnd.getUTCFullYear();
    for (let y = startYear; y <= endYear; y++) {
      emit(`${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
  }

  return results;
}

export function expandRules(
  rules: RuleInput[],
  rangeStart: string,
  rangeEnd: string
): ProjectedOccurrence[] {
  return rules.flatMap((r) => expandRule(r, rangeStart, rangeEnd));
}
```

**Step 5: Run tests to verify they pass**

```bash
cd server && npx jest src/lib/recurringExpansion.test.ts
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add server/src/lib/recurringExpansion.ts server/src/lib/recurringExpansion.test.ts server/package.json
git commit -m "feat: add recurring rule expansion logic with tests"
```

---

## Task 3: Server — Validations and Serialization for RecurringRule

**Files:**
- Modify: `server/src/lib/validations.ts`
- Modify: `server/src/lib/serialize.ts`

**Step 1: Add Zod schemas to `validations.ts`**

Add after existing schemas:

```typescript
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

export type CreateRecurringRuleInput = z.infer<typeof createRecurringRuleSchema>;
export type UpdateRecurringRuleInput = z.infer<typeof updateRecurringRuleSchema>;
```

**Step 2: Add serializer to `serialize.ts`**

Add after existing serializers:

```typescript
interface PrismaRecurringRule {
  id: string;
  name: string;
  amount: Decimal;
  type: string;
  frequency: string;
  anchorDays: number[];
  startDate: Date;
  endDate: Date | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeRecurringRule(r: PrismaRecurringRule) {
  return {
    id: r.id,
    name: r.name,
    amount: r.amount.toNumber(),
    type: r.type,
    frequency: r.frequency,
    anchorDays: r.anchorDays,
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
    notes: r.notes,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
```

**Step 3: Commit**

```bash
git add server/src/lib/validations.ts server/src/lib/serialize.ts
git commit -m "feat: add RecurringRule validation schemas and serializer"
```

---

## Task 4: Server — CRUD Routes for Recurring Rules

**Files:**
- Create: `server/src/routes/recurringRules.ts`
- Modify: `server/src/index.ts`

**Step 1: Create `server/src/routes/recurringRules.ts`**

```typescript
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
      where: { id: req.params.id },
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

// PATCH /api/recurring-rules/:id (active toggle)
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateRecurringRuleSchema.parse(req.body);
    const rule = await prisma.recurringRule.update({
      where: { id: req.params.id },
      data: {
        ...(data.active !== undefined && { active: data.active }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.amount !== undefined && { amount: data.amount }),
      },
    });
    res.json(serializeRecurringRule(rule));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/recurring-rules/:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.recurringRule.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
```

**Step 2: Register routes in `server/src/index.ts`**

Add after the existing route imports:

```typescript
import recurringRuleRoutes from "./routes/recurringRules";
```

Add after `app.use("/api/budget-items", budgetItemRoutes);`:

```typescript
app.use("/api/recurring-rules", recurringRuleRoutes);
```

**Step 3: Commit**

```bash
git add server/src/routes/recurringRules.ts server/src/index.ts
git commit -m "feat: add recurring rules CRUD routes"
```

---

## Task 5: Server — Wire Projected Occurrences into Calendar Endpoint

**Files:**
- Modify: `server/src/routes/transactions.ts`

**Step 1: Update the `/calendar` route**

Replace the calendar handler in `server/src/routes/transactions.ts`:

```typescript
import { expandRules, RuleInput } from "../lib/recurringExpansion";
```

Replace the existing `GET /calendar` handler body (from `const lastDay = ...` onward) with:

```typescript
const lastDay = new Date(year, month, 0);
const rangeStart = "1970-01-01"; // all history for accurate running balance
const rangeEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

// Fetch real transactions
const transactions = await prisma.transaction.findMany({
  where: { date: { lte: lastDay } },
  orderBy: { date: "asc" },
  select: { date: true, amount: true },
});

// Fetch active recurring rules and expand projections
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

// Merge: real transactions + projected occurrences
const txnInputs = [
  ...transactions.map((t) => ({
    date: t.date.toISOString().slice(0, 10),
    amount: t.amount.toNumber(),
  })),
  ...projected.map((p) => ({ date: p.date, amount: p.amount })),
];

const days = computeMonthMetrics(year, month, txnInputs);

// Also return projected occurrences for the requested month so the UI can render them distinctly
const monthStr = `${year}-${String(month).padStart(2, "0")}`;
const monthProjected = projected.filter((p) => p.date.startsWith(monthStr));

res.json({ year, month, days, projected: monthProjected });
```

**Step 2: Restart the server and manually verify**

```bash
curl "http://localhost:3004/api/recurring-rules"
# Expected: {"data":[]}

curl -X POST http://localhost:3004/api/recurring-rules \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Mortgage","amount":-2500,"type":"BILL","frequency":"MONTHLY","anchorDays":[1],"startDate":"2026-01-01"}'

curl "http://localhost:3004/api/transactions/calendar?year=2026&month=3"
# Expected: projected array contains {date:"2026-03-01", amount:-2500, projected:true, ...}
```

**Step 3: Commit**

```bash
git add server/src/routes/transactions.ts
git commit -m "feat: include projected recurring occurrences in calendar endpoint"
```

---

## Task 6: Server — Auto-Match Endpoint

**Files:**
- Create: `server/src/lib/autoMatch.ts`
- Modify: `server/src/routes/transactions.ts`

**Step 1: Create `server/src/lib/autoMatch.ts`**

```typescript
import { ProjectedOccurrence, RuleInput, expandRule } from "./recurringExpansion";

export interface MatchCandidate {
  transaction: { id: string; date: string; name: string; amount: number };
  rule: { id: string; name: string };
  projectedDate: string;
  confidence: number;
}

function daysDiff(a: string, b: string): number {
  const diff = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  // Check word overlap
  const wordsA = new Set(na.split(/\s+/));
  const wordsB = new Set(nb.split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

export function findMatches(
  transactions: Array<{ id: string; date: string; name: string; amount: number; reconciled: boolean }>,
  rules: RuleInput[],
  alreadyMatchedTransactionIds: Set<string>
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  const DATE_WINDOW = 3;
  const AMOUNT_TOLERANCE = 0.05;

  for (const txn of transactions) {
    if (txn.reconciled) continue;
    if (alreadyMatchedTransactionIds.has(txn.id)) continue;

    for (const rule of rules) {
      if (!rule.active) continue;

      // Expand a small window around the transaction date
      const windowStart = new Date(txn.date);
      windowStart.setDate(windowStart.getDate() - DATE_WINDOW);
      const windowEnd = new Date(txn.date);
      windowEnd.setDate(windowEnd.getDate() + DATE_WINDOW);

      const occurrences = expandRule(
        rule,
        windowStart.toISOString().slice(0, 10),
        windowEnd.toISOString().slice(0, 10)
      );

      for (const occ of occurrences) {
        const amountDiff = Math.abs(Math.abs(txn.amount) - Math.abs(occ.amount)) / Math.abs(occ.amount);
        if (amountDiff > AMOUNT_TOLERANCE) continue;

        const dayDiff = daysDiff(txn.date, occ.date);
        const nameSim = nameSimilarity(txn.name, rule.name);
        const confidence = (1 - dayDiff / DATE_WINDOW) * 0.4 + nameSim * 0.4 + (1 - amountDiff) * 0.2;

        if (confidence >= 0.5) {
          candidates.push({
            transaction: { id: txn.id, date: txn.date, name: txn.name, amount: txn.amount },
            rule: { id: rule.id, name: rule.name },
            projectedDate: occ.date,
            confidence: Math.round(confidence * 100) / 100,
          });
        }
      }
    }
  }

  // Sort by confidence descending, deduplicate (keep best match per transaction)
  candidates.sort((a, b) => b.confidence - a.confidence);
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.transaction.id)) return false;
    seen.add(c.transaction.id);
    return true;
  });
}
```

**Step 2: Add auto-match routes to `transactions.ts`**

Add these routes BEFORE the `/:id` route (route order matters in Express):

```typescript
import { findMatches } from "../lib/autoMatch";
import { RuleInput } from "../lib/recurringExpansion";

// GET /api/transactions/unmatched — auto-match suggestions
router.get("/unmatched", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [transactions, rules, existingMatches] = await Promise.all([
      prisma.transaction.findMany({
        where: { reconciled: false },
        orderBy: { date: "desc" },
        take: 200,
        select: { id: true, date: true, name: true, amount: true, reconciled: true },
      }),
      prisma.recurringRule.findMany({ where: { active: true } }),
      prisma.recurringRuleMatch.findMany({ select: { transactionId: true } }),
    ]);

    const alreadyMatched = new Set(existingMatches.map((m) => m.transactionId));

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

    const txnInputs = transactions.map((t) => ({
      id: t.id,
      date: t.date.toISOString().slice(0, 10),
      name: t.name,
      amount: t.amount.toNumber(),
      reconciled: t.reconciled,
    }));

    const candidates = findMatches(txnInputs, ruleInputs, alreadyMatched);
    res.json({ data: candidates });
  } catch (err) {
    next(err);
  }
});
```

Add match confirm/dismiss routes in `recurringRules.ts`:

```typescript
import { prisma } from "../lib/db";

// POST /api/recurring-rules/:id/match — confirm a match
router.post("/:id/match", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { transactionId, projectedDate } = req.body as {
      transactionId: string;
      projectedDate: string;
    };
    await prisma.$transaction([
      prisma.recurringRuleMatch.create({
        data: {
          ruleId: req.params.id,
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
```

**Step 3: Commit**

```bash
git add server/src/lib/autoMatch.ts server/src/routes/transactions.ts server/src/routes/recurringRules.ts
git commit -m "feat: add auto-match endpoint for recurring rule reconciliation"
```

---

## Task 7: Client — Types and API Functions

**Files:**
- Modify: `client/src/types/index.ts`
- Modify: `client/src/lib/api.ts`

**Step 1: Add types to `client/src/types/index.ts`**

Add after existing types:

```typescript
export type RecurringFrequency =
  | "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY"
  | "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface RecurringRule {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  frequency: RecurringFrequency;
  anchorDays: number[];
  startDate: string;
  endDate: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectedOccurrence {
  date: string;
  amount: number;
  projected: true;
  ruleId: string;
  ruleName: string;
  type: string;
}

export interface MatchCandidate {
  transaction: { id: string; date: string; name: string; amount: number };
  rule: { id: string; name: string };
  projectedDate: string;
  confidence: number;
}
```

Also update `CalendarResponse` to include the projected field:

```typescript
export interface CalendarResponse {
  year: number;
  month: number;
  days: DayMetrics[];
  projected: ProjectedOccurrence[];
}
```

**Step 2: Add API functions to `client/src/lib/api.ts`**

Add at the end of the file:

```typescript
// Recurring Rules
export function fetchRecurringRules(): Promise<{ data: RecurringRule[] }> {
  return fetchJSON(`${API_BASE}/recurring-rules`);
}

export function createRecurringRule(
  data: Omit<RecurringRule, "id" | "createdAt" | "updatedAt">
): Promise<RecurringRule> {
  return fetchJSON(`${API_BASE}/recurring-rules`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateRecurringRule(
  id: string,
  data: Omit<RecurringRule, "id" | "createdAt" | "updatedAt">
): Promise<RecurringRule> {
  return fetchJSON(`${API_BASE}/recurring-rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function patchRecurringRule(
  id: string,
  data: Partial<RecurringRule>
): Promise<RecurringRule> {
  return fetchJSON(`${API_BASE}/recurring-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteRecurringRule(id: string): Promise<void> {
  return fetchJSON(`${API_BASE}/recurring-rules/${id}`, { method: "DELETE" });
}

export function confirmMatch(
  ruleId: string,
  transactionId: string,
  projectedDate: string
): Promise<{ ok: boolean }> {
  return fetchJSON(`${API_BASE}/recurring-rules/${ruleId}/match`, {
    method: "POST",
    body: JSON.stringify({ transactionId, projectedDate }),
  });
}

export function fetchUnmatched(): Promise<{ data: MatchCandidate[] }> {
  return fetchJSON(`${API_BASE}/transactions/unmatched`);
}
```

**Step 3: Commit**

```bash
git add client/src/types/index.ts client/src/lib/api.ts
git commit -m "feat: add RecurringRule types and API client functions"
```

---

## Task 8: Client — Recurring Rules Page

**Files:**
- Create: `client/src/pages/RecurringPage.tsx`
- Create: `client/src/components/recurring/RecurringRuleForm.tsx`
- Modify: `client/src/App.tsx`

**Step 1: Create `client/src/components/recurring/RecurringRuleForm.tsx`**

This is a modal form for creating/editing rules. Key logic: the `anchorDays` UI changes based on `frequency`.

```tsx
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createRecurringRule, updateRecurringRule } from "@/lib/api";
import type { RecurringRule, RecurringFrequency, TransactionType } from "@/types";

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FREQUENCIES: RecurringFrequency[] = ["WEEKLY", "BIWEEKLY", "SEMIMONTHLY", "MONTHLY", "QUARTERLY", "YEARLY"];

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: RecurringRule | null;
}

const defaultForm = {
  name: "",
  amount: "",
  type: "BILL" as TransactionType,
  frequency: "MONTHLY" as RecurringFrequency,
  anchorDay1: "1",
  anchorDay2: "15",
  anchorDow: "1",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  notes: "",
  active: true,
};

export default function RecurringRuleForm({ open, onClose, editing }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() =>
    editing
      ? {
          name: editing.name,
          amount: String(Math.abs(editing.amount)),
          type: editing.type,
          frequency: editing.frequency,
          anchorDay1: String(editing.anchorDays[0] ?? 1),
          anchorDay2: String(editing.anchorDays[1] ?? 15),
          anchorDow: String(editing.anchorDays[0] ?? 1),
          startDate: editing.startDate,
          endDate: editing.endDate ?? "",
          notes: editing.notes ?? "",
          active: editing.active,
        }
      : { ...defaultForm }
  );

  function buildPayload() {
    const isIncome = form.type === "INCOME";
    const rawAmount = parseFloat(form.amount);
    const amount = isIncome ? Math.abs(rawAmount) : -Math.abs(rawAmount);

    let anchorDays: number[] = [];
    if (form.frequency === "WEEKLY" || form.frequency === "BIWEEKLY") {
      anchorDays = [parseInt(form.anchorDow)];
    } else if (form.frequency === "SEMIMONTHLY") {
      anchorDays = [parseInt(form.anchorDay1), parseInt(form.anchorDay2)];
    } else if (form.frequency !== "YEARLY") {
      anchorDays = [parseInt(form.anchorDay1)];
    }

    return {
      name: form.name,
      amount,
      type: form.type,
      frequency: form.frequency,
      anchorDays,
      startDate: form.startDate,
      endDate: form.endDate || null,
      notes: form.notes || null,
      active: form.active,
    };
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      return editing
        ? updateRecurringRule(editing.id, payload)
        : createRecurringRule(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-rules"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      toast.success(editing ? "Rule updated" : "Rule created");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Recurring Rule" : "New Recurring Rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Mortgage" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type")(v as TransactionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["INCOME", "BILL", "DEBT", "SPENDING", "SUBSCRIPTION"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={form.amount}
                onChange={(e) => set("amount")(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Frequency</Label>
            <Select value={form.frequency} onValueChange={(v) => set("frequency")(v as RecurringFrequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Anchor day inputs - change based on frequency */}
          {(form.frequency === "WEEKLY" || form.frequency === "BIWEEKLY") && (
            <div className="space-y-1">
              <Label>Day of Week</Label>
              <Select value={form.anchorDow} onValueChange={set("anchorDow")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.frequency === "SEMIMONTHLY" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Day</Label>
                <Input type="number" min="1" max="31" value={form.anchorDay1}
                  onChange={(e) => set("anchorDay1")(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Second Day</Label>
                <Input type="number" min="1" max="31" value={form.anchorDay2}
                  onChange={(e) => set("anchorDay2")(e.target.value)} />
              </div>
            </div>
          )}
          {(form.frequency === "MONTHLY" || form.frequency === "QUARTERLY") && (
            <div className="space-y-1">
              <Label>Day of Month</Label>
              <Input type="number" min="1" max="31" value={form.anchorDay1}
                onChange={(e) => set("anchorDay1")(e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate")(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End Date (optional)</Label>
              <Input type="date" value={form.endDate} onChange={(e) => set("endDate")(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name || !form.amount}>
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Create `client/src/pages/RecurringPage.tsx`**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchRecurringRules, deleteRecurringRule, patchRecurringRule } from "@/lib/api";
import { TypeBadge } from "@/components/ui/TypeBadge";
import RecurringRuleForm from "@/components/recurring/RecurringRuleForm";
import type { RecurringRule } from "@/types";

function formatAmount(amount: number, type: string) {
  const abs = Math.abs(amount).toFixed(2);
  return type === "INCOME" ? `+$${abs}` : `-$${abs}`;
}

function nextOccurrence(rule: RecurringRule): string {
  const today = new Date().toISOString().slice(0, 10);
  // Simple display — just show frequency and anchor info
  if (rule.frequency === "MONTHLY") return `Monthly on day ${rule.anchorDays[0]}`;
  if (rule.frequency === "SEMIMONTHLY") return `${rule.anchorDays[0]}th & ${rule.anchorDays[1]}th monthly`;
  if (rule.frequency === "QUARTERLY") return `Quarterly on day ${rule.anchorDays[0]}`;
  if (rule.frequency === "YEARLY") return `Yearly on ${rule.startDate.slice(5)}`;
  if (rule.frequency === "WEEKLY") return `Weekly`;
  if (rule.frequency === "BIWEEKLY") return `Every 2 weeks`;
  return rule.frequency;
}

export default function RecurringPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recurring-rules"],
    queryFn: fetchRecurringRules,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecurringRule,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring-rules"] }); toast.success("Rule deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => patchRecurringRule(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-rules"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const rules = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recurring Rules</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Rule
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading...</p>}
      {!isLoading && rules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No recurring rules yet. Add your first one to start forecasting.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} className={rule.active ? "" : "opacity-50"}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{rule.name}</CardTitle>
                  <TypeBadge type={rule.type} />
                  {!rule.active && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-semibold ${rule.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatAmount(rule.amount, rule.type)}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => toggleMutation.mutate({ id: rule.id, active: !rule.active })}>
                    {rule.active ? "⏸" : "▶"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(rule); setFormOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this rule?")) deleteMutation.mutate(rule.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{nextOccurrence(rule)}</p>
              {rule.notes && <p className="text-sm mt-1">{rule.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <RecurringRuleForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing}
      />
    </div>
  );
}
```

**Step 3: Add route and nav link to `client/src/App.tsx`**

Add import:
```tsx
import { Calendar, BookOpen, RefreshCw } from "lucide-react";
import RecurringPage from "@/pages/RecurringPage";
```

Add nav link after Ledger:
```tsx
<NavLink
  to="/recurring"
  className={({ isActive }) =>
    cn(
      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
      isActive && "bg-accent text-accent-foreground"
    )
  }
>
  <RefreshCw className="h-4 w-4" />
  Recurring
</NavLink>
```

Add route:
```tsx
<Route path="/recurring" element={<RecurringPage />} />
```

**Step 4: Commit**

```bash
git add client/src/pages/RecurringPage.tsx client/src/components/recurring/RecurringRuleForm.tsx client/src/App.tsx
git commit -m "feat: add Recurring Rules page with create/edit/delete/toggle"
```

---

## Task 9: Client — Calendar Shows Projected Occurrences

**Files:**
- Modify: `client/src/components/calendar/CalendarView.tsx`

**Step 1: Read the existing CalendarView to understand the day cell rendering, then:**

Add a "Show projections" toggle to the header area:

```tsx
const [showProjected, setShowProjected] = useState(true);
```

The `useQuery` for calendar already fetches the full `CalendarResponse`. Update usage to pass projected data to day cells. In the day cell, check `calendarData.projected` for any occurrences matching that day and render them as small muted badges:

```tsx
// Inside day cell rendering, after existing metrics:
{showProjected && calendarData?.projected
  .filter((p) => p.date === dateStr)
  .map((p) => (
    <div key={p.ruleId} className="text-xs text-muted-foreground border border-dashed rounded px-1 mt-1">
      {p.ruleName}: {p.amount < 0 ? "-" : "+"}${Math.abs(p.amount).toFixed(0)}
    </div>
  ))
}
```

Add a toggle button in the calendar header:

```tsx
<Button variant={showProjected ? "secondary" : "ghost"} size="sm"
  onClick={() => setShowProjected((v) => !v)}>
  {showProjected ? "Hide" : "Show"} Projections
</Button>
```

**Step 2: Commit**

```bash
git add client/src/components/calendar/CalendarView.tsx
git commit -m "feat: render projected recurring occurrences in calendar day cells"
```

---

## Task 10: Client — Suggested Matches Banner in Ledger

**Files:**
- Create: `client/src/components/ledger/MatchSuggestions.tsx`
- Modify: `client/src/pages/LedgerPage.tsx`

**Step 1: Create `client/src/components/ledger/MatchSuggestions.tsx`**

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchUnmatched, confirmMatch } from "@/lib/api";

export default function MatchSuggestions() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["unmatched"],
    queryFn: fetchUnmatched,
    refetchInterval: 60_000,
  });

  const confirmMutation = useMutation({
    mutationFn: ({ ruleId, transactionId, projectedDate }: { ruleId: string; transactionId: string; projectedDate: string }) =>
      confirmMatch(ruleId, transactionId, projectedDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unmatched"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Match confirmed — transaction reconciled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const candidates = (data?.data ?? []).filter((c) => !dismissed.has(c.transaction.id));

  if (candidates.length === 0) return null;

  return (
    <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {candidates.length} suggested match{candidates.length > 1 ? "es" : ""} to reconcile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {candidates.map((c) => (
          <div key={c.transaction.id} className="flex items-center justify-between text-sm gap-4">
            <div>
              <span className="font-medium">{c.transaction.name}</span>
              <span className="text-muted-foreground ml-2">${Math.abs(c.transaction.amount).toFixed(2)} on {c.transaction.date}</span>
              <span className="text-muted-foreground ml-2">→ <em>{c.rule.name}</em> (projected {c.projectedDate})</span>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="outline" className="h-7 text-green-700 border-green-400"
                onClick={() => confirmMutation.mutate({ ruleId: c.rule.id, transactionId: c.transaction.id, projectedDate: c.projectedDate })}>
                <CheckCircle className="h-3 w-3 mr-1" /> Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-muted-foreground"
                onClick={() => setDismissed((s) => new Set([...s, c.transaction.id]))}>
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

Note: add `import { useState } from "react";` at the top of this file.

**Step 2: Add to `client/src/pages/LedgerPage.tsx`**

Import and render at top of page content, above the filters:

```tsx
import MatchSuggestions from "@/components/ledger/MatchSuggestions";

// In the JSX, add before the TransactionTable:
<MatchSuggestions />
```

**Step 3: Commit**

```bash
git add client/src/components/ledger/MatchSuggestions.tsx client/src/pages/LedgerPage.tsx
git commit -m "feat: add suggested match banner to ledger for recurring reconciliation"
```

---

## Task 11: Push to Main

```bash
git push origin main
```

Verify in the running app:
1. Navigate to `/recurring` — create a monthly rule (e.g. Mortgage, -2500, BILL, day 1)
2. Navigate to `/calendar` — confirm day 1 of current month shows a projected entry
3. Navigate to `/ledger` — if any unreconciled transactions match, the banner appears
