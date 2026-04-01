/**
 * YNAB API client — thin wrapper around the YNAB REST API v1.
 * Docs: https://api.ynab.com/v1
 */

const YNAB_BASE = "https://api.ynab.com/v1";

interface YnabApiError {
  error: { id: string; name: string; detail: string };
}

async function ynabFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${YNAB_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as YnabApiError;
    const detail = body?.error?.detail ?? `YNAB API error ${res.status}`;
    throw new Error(detail);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

// ─── Types matching YNAB API responses ───────────────────────────────────────

export interface YnabBudgetSummary {
  id: string;
  name: string;
  last_modified_on: string;
}

export interface YnabAccount {
  id: string;
  name: string;
  type: string;
  on_budget: boolean;
  closed: boolean;
  balance: number; // milliunits
  cleared_balance: number;
  uncleared_balance: number;
}

export interface YnabTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // milliunits (1000 = $1.00)
  memo: string | null;
  cleared: "cleared" | "uncleared" | "reconciled";
  approved: boolean;
  payee_name: string | null;
  category_name: string | null;
  account_id: string;
  account_name: string;
  deleted: boolean;
}

export interface YnabTransactionsResponse {
  transactions: YnabTransaction[];
  server_knowledge: number;
}

// ─── API methods ─────────────────────────────────────────────────────────────

export async function getBudgets(
  token: string
): Promise<YnabBudgetSummary[]> {
  const data = await ynabFetch<{ budgets: YnabBudgetSummary[] }>(
    "/budgets",
    token
  );
  return data.budgets;
}

export async function getAccounts(
  token: string,
  budgetId: string
): Promise<YnabAccount[]> {
  const data = await ynabFetch<{ accounts: YnabAccount[] }>(
    `/budgets/${budgetId}/accounts`,
    token
  );
  return data.accounts.filter((a) => !a.closed);
}

export async function getTransactions(
  token: string,
  budgetId: string,
  sinceDate?: string,
  serverKnowledge?: number
): Promise<YnabTransactionsResponse> {
  let path = `/budgets/${budgetId}/transactions`;
  const params = new URLSearchParams();
  if (sinceDate) params.set("since_date", sinceDate);
  if (serverKnowledge != null)
    params.set("last_knowledge_of_server", String(serverKnowledge));
  const qs = params.toString();
  if (qs) path += `?${qs}`;

  return ynabFetch<YnabTransactionsResponse>(path, token);
}

export async function getAccountTransactions(
  token: string,
  budgetId: string,
  accountId: string,
  sinceDate?: string,
  serverKnowledge?: number
): Promise<YnabTransactionsResponse> {
  let path = `/budgets/${budgetId}/accounts/${accountId}/transactions`;
  const params = new URLSearchParams();
  if (sinceDate) params.set("since_date", sinceDate);
  if (serverKnowledge != null)
    params.set("last_knowledge_of_server", String(serverKnowledge));
  const qs = params.toString();
  if (qs) path += `?${qs}`;

  return ynabFetch<YnabTransactionsResponse>(path, token);
}

/** Validate a personal access token by attempting to list budgets. */
export async function validateToken(token: string): Promise<boolean> {
  try {
    await getBudgets(token);
    return true;
  } catch {
    return false;
  }
}
