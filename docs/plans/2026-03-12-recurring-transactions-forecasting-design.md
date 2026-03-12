# Recurring Transactions & Forecasting — Design

**Date:** 2026-03-12

## Overview

Add support for recurring income and expense rules (mortgage, payroll, subscriptions, etc.) that project forward into the calendar view. Projected occurrences appear alongside actual ledger transactions so the user sees expected balances at a glance. When actual bank transactions arrive they are auto-matched to projected occurrences and reconciled with a single confirmation.

---

## Data Model

New `RecurringRule` table in Prisma:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | String(255) | e.g. "Mortgage", "Alkami Payroll" |
| `amount` | Decimal(12,2) | Negative = outflow, positive = inflow |
| `type` | TransactionType | INCOME, BILL, DEBT, SPENDING, SUBSCRIPTION |
| `frequency` | Enum | WEEKLY, BIWEEKLY, SEMIMONTHLY, MONTHLY, QUARTERLY, YEARLY |
| `anchorDays` | Int[] | Day(s) of month for MONTHLY/SEMIMONTHLY/QUARTERLY; day of week (0–6) for WEEKLY/BIWEEKLY; ignored for YEARLY (uses startDate's month+day) |
| `startDate` | Date | When the rule begins generating occurrences |
| `endDate` | Date? | Optional end date |
| `notes` | String? | |
| `active` | Boolean | Soft-disable without deleting |

New `RecurringRuleMatch` join table:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `ruleId` | UUID | FK → RecurringRule |
| `transactionId` | UUID | FK → Transaction |
| `projectedDate` | Date | The occurrence date that was matched |

The existing `BudgetItem` model is unchanged.

---

## Backend

### New routes
- `GET /api/recurring-rules` — list all rules
- `POST /api/recurring-rules` — create rule
- `PUT /api/recurring-rules/:id` — update rule
- `DELETE /api/recurring-rules/:id` — delete rule

### Calendar endpoint changes
Before computing metrics, expand all active rules into projected `{ date, amount }` occurrences covering the full history through the end of the requested month. Merge with real transactions and pass the combined list to `computeMonthMetrics` — no changes needed to that function. Each projected occurrence carries a `projected: true` flag for the frontend to distinguish visually.

### Expansion logic
- `MONTHLY` → fire on each `anchorDays[0]` day of every month from startDate to endDate
- `SEMIMONTHLY` → fire on both `anchorDays[0]` and `anchorDays[1]` each month
- `QUARTERLY` → fire on `anchorDays[0]` every 3 months from startDate's month
- `WEEKLY` → fire every week on `anchorDays[0]` (day of week, 0=Sunday)
- `BIWEEKLY` → fire every other week on `anchorDays[0]`, anchored from startDate
- `YEARLY` → fire once per year on startDate's month and day

### Auto-match endpoint
- `GET /api/transactions/unmatched` — returns ledger transactions with a high-confidence candidate rule match: within ±3 days of a projected occurrence, amount within ±5%, fuzzy name similarity. Returns transaction + matched rule + projected date.
- `POST /api/recurring-rules/:id/match` — accepts `{ transactionId, projectedDate }`. Records the match in `RecurringRuleMatch`, sets `transaction.reconciled = true`.
- `DELETE /api/recurring-rules/:id/match/:transactionId` — dismiss a match suggestion without linking.

---

## Frontend

### New "Recurring" page
- Added to sidebar navigation
- Table of all rules: name, type, frequency, amount, next occurrence, active toggle
- Create/edit modal form:
  - Name, amount, type, notes fields
  - Frequency picker — drives which anchorDays input renders:
    - MONTHLY/QUARTERLY: single day-of-month picker (1–31)
    - SEMIMONTHLY: two day-of-month pickers
    - WEEKLY/BIWEEKLY: day-of-week picker (Mon–Sun)
    - YEARLY: no anchorDays input (uses startDate)
  - Start date, optional end date
  - Active toggle

### Calendar changes
- Projected occurrences render in day cells with muted color and dashed border, labeled "projected"
- S/O/I/E numbers include projected amounts
- Toggle at top of calendar: "Show projections" (on by default)

### Ledger changes
- "Suggested Matches" banner at top of ledger when unmatched transactions exist
- Each suggestion: transaction details + matched rule + projected date + Confirm / Dismiss buttons
- Confirm → marks transaction reconciled, records match, removes from suggestions
- Dismiss → hides suggestion without linking (stored client-side or as a dismissed flag server-side)
