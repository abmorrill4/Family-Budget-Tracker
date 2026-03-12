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
}

export interface TransactionFilters {
  search: string;
  type: TransactionType | "";
  reconciled: "" | "true" | "false";
  start: string;
  end: string;
  page: number;
}
