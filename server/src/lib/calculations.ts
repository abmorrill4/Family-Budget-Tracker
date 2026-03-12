export interface TransactionInput {
  date: string; // YYYY-MM-DD
  amount: number;
}

export interface DayMetrics {
  date: string;
  starting: number;
  outflows: number;
  inflows: number;
  ending: number;
  hasActivity: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Computes per-day S/O/I/E metrics for every day in the given month.
 *
 * Transactions must include ALL transactions from the beginning of time
 * through the last day of the requested month.
 *
 * S (Starting)  = SUM(amount) WHERE date < thisDay
 * O (Outflows)  = ABS(SUM(amount)) WHERE date = thisDay AND amount < 0
 * I (Inflows)   = SUM(amount) WHERE date = thisDay AND amount >= 0
 * E (Ending)    = SUM(amount) WHERE date <= thisDay
 */
export function computeMonthMetrics(
  year: number,
  month: number,
  transactions: TransactionInput[]
): DayMetrics[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  // Build a map of date -> { inflows, outflows } for days in the target month
  // and compute the running sum of everything before the month
  const dayData = new Map<
    string,
    { inflows: number; outflows: number }
  >();

  let priorSum = 0; // sum of all transactions before the first day of the month

  const firstDayStr = `${monthStr}-01`;

  for (const txn of transactions) {
    if (txn.date < firstDayStr) {
      priorSum += txn.amount;
    } else {
      const entry = dayData.get(txn.date);
      if (entry) {
        if (txn.amount < 0) {
          entry.outflows += txn.amount;
        } else {
          entry.inflows += txn.amount;
        }
      } else {
        dayData.set(txn.date, {
          inflows: txn.amount >= 0 ? txn.amount : 0,
          outflows: txn.amount < 0 ? txn.amount : 0,
        });
      }
    }
  }

  const results: DayMetrics[] = [];
  let runningTotal = priorSum;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthStr}-${String(d).padStart(2, "0")}`;
    const data = dayData.get(dateStr);

    const starting = runningTotal;
    const inflows = data ? data.inflows : 0;
    const outflows = data ? data.outflows : 0;
    const ending = starting + inflows + outflows;

    results.push({
      date: dateStr,
      starting: round2(starting),
      outflows: round2(Math.abs(outflows)),
      inflows: round2(inflows),
      ending: round2(ending),
      hasActivity: data !== undefined,
    });

    runningTotal = ending;
  }

  return results;
}
