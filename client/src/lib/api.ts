import type {
  Transaction,
  BudgetItem,
  PaginatedResponse,
  CalendarResponse,
  TransactionFilters,
  YnabBudget,
  YnabAccount,
  YnabStatus,
  YnabSyncResult,
  YnabConnection,
} from "@/types";

const API_BASE = "/api";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Transactions
export function fetchTransactions(
  filters: TransactionFilters
): Promise<PaginatedResponse<Transaction>> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.type) params.set("type", filters.type);
  if (filters.reconciled) params.set("reconciled", filters.reconciled);
  if (filters.start) params.set("start", filters.start);
  if (filters.end) params.set("end", filters.end);
  params.set("page", String(filters.page));
  params.set("limit", "50");
  return fetchJSON(`${API_BASE}/transactions?${params}`);
}

export function fetchTransaction(id: string): Promise<Transaction> {
  return fetchJSON(`${API_BASE}/transactions/${id}`);
}

export function createTransaction(
  data: Omit<Transaction, "id" | "source" | "ynabId" | "createdAt" | "updatedAt">
): Promise<Transaction> {
  return fetchJSON(`${API_BASE}/transactions`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTransaction(
  id: string,
  data: Omit<Transaction, "id" | "source" | "ynabId" | "createdAt" | "updatedAt">
): Promise<Transaction> {
  return fetchJSON(`${API_BASE}/transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function patchTransaction(
  id: string,
  data: Partial<Transaction>
): Promise<Transaction> {
  return fetchJSON(`${API_BASE}/transactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteTransaction(id: string): Promise<void> {
  return fetchJSON(`${API_BASE}/transactions/${id}`, {
    method: "DELETE",
  });
}

export function fetchCalendar(
  year: number,
  month: number
): Promise<CalendarResponse> {
  return fetchJSON(
    `${API_BASE}/transactions/calendar?year=${year}&month=${month}`
  );
}

// Transactions by date (for day drill-down)
export function fetchTransactionsByDate(
  date: string
): Promise<PaginatedResponse<Transaction>> {
  return fetchJSON(
    `${API_BASE}/transactions?start=${date}&end=${date}&limit=200`
  );
}

// Budget Items
export function fetchBudgetItems(params?: {
  start?: string;
  end?: string;
  type?: string;
}): Promise<{ data: BudgetItem[] }> {
  const searchParams = new URLSearchParams();
  if (params?.start) searchParams.set("start", params.start);
  if (params?.end) searchParams.set("end", params.end);
  if (params?.type) searchParams.set("type", params.type);
  return fetchJSON(`${API_BASE}/budget-items?${searchParams}`);
}

export function createBudgetItem(
  data: Omit<BudgetItem, "id" | "createdAt" | "updatedAt">
): Promise<BudgetItem> {
  return fetchJSON(`${API_BASE}/budget-items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateBudgetItem(
  id: string,
  data: Partial<Omit<BudgetItem, "id" | "createdAt" | "updatedAt">>
): Promise<BudgetItem> {
  return fetchJSON(`${API_BASE}/budget-items/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteBudgetItem(id: string): Promise<void> {
  return fetchJSON(`${API_BASE}/budget-items/${id}`, {
    method: "DELETE",
  });
}

// YNAB Integration
export function validateYnabToken(
  token: string
): Promise<{ valid: boolean }> {
  return fetchJSON(`${API_BASE}/ynab/validate`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function fetchYnabBudgets(
  token: string
): Promise<{ budgets: YnabBudget[] }> {
  return fetchJSON(`${API_BASE}/ynab/budgets`, {
    headers: { "x-ynab-token": token },
  });
}

export function fetchYnabAccounts(
  token: string,
  budgetId: string
): Promise<{ accounts: YnabAccount[] }> {
  return fetchJSON(`${API_BASE}/ynab/budgets/${budgetId}/accounts`, {
    headers: { "x-ynab-token": token },
  });
}

export function connectYnab(data: {
  token: string;
  budgetId: string;
  budgetName: string;
  accountIds: string[];
  syncIntervalMinutes: number;
}): Promise<{ connection: YnabConnection; sync: YnabSyncResult }> {
  return fetchJSON(`${API_BASE}/ynab/connect`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function syncYnab(): Promise<YnabSyncResult> {
  return fetchJSON(`${API_BASE}/ynab/sync`, { method: "POST" });
}

export function fetchYnabStatus(): Promise<YnabStatus> {
  return fetchJSON(`${API_BASE}/ynab/status`);
}

export function updateYnabSettings(data: {
  syncIntervalMinutes?: number;
  accountIds?: string[];
}): Promise<{ connection: YnabConnection }> {
  return fetchJSON(`${API_BASE}/ynab/settings`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function disconnectYnab(): Promise<void> {
  return fetchJSON(`${API_BASE}/ynab/disconnect`, {
    method: "DELETE",
  });
}
