export type TransactionType = "INCOME" | "BILL" | "DEBT" | "SPENDING" | "SUBSCRIPTION";

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  name: string;
  amount: number;
  reconciled: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetItem {
  id: string;
  date: string;
  type: TransactionType;
  name: string;
  amount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DayMetrics {
  date: string;
  starting: number;
  outflows: number;
  inflows: number;
  ending: number;
  hasActivity: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CalendarResponse {
  year: number;
  month: number;
  days: DayMetrics[];
  projected: ProjectedOccurrence[];
}

export interface TransactionFilters {
  search: string;
  type: TransactionType | "";
  reconciled: "" | "true" | "false";
  start: string;
  end: string;
  page: number;
}

export type RecurringFrequency =
  | "WEEKLY"
  | "BIWEEKLY"
  | "SEMIMONTHLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "YEARLY";

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
