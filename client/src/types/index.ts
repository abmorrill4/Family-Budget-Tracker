export type TransactionType = "INCOME" | "BILL" | "DEBT" | "SPENDING" | "SUBSCRIPTION";
export type TransactionSource = "MANUAL" | "YNAB";

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  name: string;
  amount: number;
  reconciled: boolean;
  notes: string | null;
  source: TransactionSource;
  ynabId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface YnabBudget {
  id: string;
  name: string;
  last_modified_on: string;
}

export interface YnabAccount {
  id: string;
  name: string;
  type: string;
  on_budget: boolean;
  balance: number;
}

export interface YnabConnection {
  id: string;
  budgetId: string;
  budgetName: string;
  accountIds: string[];
  lastSyncedAt: string | null;
  syncIntervalMinutes: number;
  active: boolean;
  createdAt: string;
}

export interface YnabStatus {
  connected: boolean;
  connection?: YnabConnection;
  transactionCount?: number;
}

export interface YnabSyncResult {
  created: number;
  updated: number;
  deleted: number;
  lastSyncedAt: string;
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
