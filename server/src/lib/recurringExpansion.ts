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
    const targetDow = rule.anchorDays[0] ?? 0;
    const cur = new Date(effectiveStart);
    while (cur.getUTCDay() !== targetDow) cur.setUTCDate(cur.getUTCDate() + 1);
    while (cur <= effectiveEnd) {
      emit(toYMD(cur));
      cur.setUTCDate(cur.getUTCDate() + 7);
    }
  } else if (rule.frequency === "BIWEEKLY") {
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
