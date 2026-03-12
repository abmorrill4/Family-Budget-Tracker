import { Decimal } from "@prisma/client/runtime/library";

interface PrismaTransaction {
  id: string;
  date: Date;
  type: string;
  name: string;
  amount: Decimal;
  reconciled?: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaBudgetItem {
  id: string;
  date: Date;
  type: string;
  name: string;
  amount: Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function serializeTransaction(t: PrismaTransaction) {
  return {
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    type: t.type,
    name: t.name,
    amount: t.amount.toNumber(),
    reconciled: t.reconciled ?? false,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializeBudgetItem(b: PrismaBudgetItem) {
  return {
    id: b.id,
    date: b.date.toISOString().slice(0, 10),
    type: b.type,
    name: b.name,
    amount: b.amount.toNumber(),
    notes: b.notes,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

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
