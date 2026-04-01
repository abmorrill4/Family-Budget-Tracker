import { Decimal } from "@prisma/client/runtime/library";

interface PrismaTransaction {
  id: string;
  date: Date;
  type: string;
  name: string;
  amount: Decimal;
  reconciled?: boolean;
  notes: string | null;
  source?: string;
  ynabId?: string | null;
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
    source: t.source ?? "MANUAL",
    ynabId: t.ynabId ?? null,
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
