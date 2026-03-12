import { expandRule } from "./recurringExpansion";

const base = {
  id: "1",
  name: "Test",
  amount: -100,
  type: "BILL" as const,
  anchorDays: [] as number[],
  active: true,
  endDate: null,
};

describe("expandRule - MONTHLY", () => {
  it("generates one occurrence per month on the anchor day", () => {
    const rule = { ...base, frequency: "MONTHLY" as const, anchorDays: [15], startDate: "2026-01-01" };
    const results = expandRule(rule, "2026-01-01", "2026-03-31");
    expect(results.map(r => r.date)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
    expect(results[0].amount).toBe(-100);
    expect(results[0].projected).toBe(true);
  });

  it("does not generate before startDate", () => {
    const rule = { ...base, frequency: "MONTHLY" as const, anchorDays: [1], startDate: "2026-02-01" };
    const results = expandRule(rule, "2026-01-01", "2026-03-31");
    expect(results.map(r => r.date)).toEqual(["2026-02-01", "2026-03-01"]);
  });

  it("does not generate after endDate", () => {
    const rule = { ...base, frequency: "MONTHLY" as const, anchorDays: [1], startDate: "2026-01-01", endDate: "2026-02-15" };
    const results = expandRule(rule, "2026-01-01", "2026-03-31");
    expect(results.map(r => r.date)).toEqual(["2026-01-01", "2026-02-01"]);
  });
});

describe("expandRule - SEMIMONTHLY", () => {
  it("generates two occurrences per month", () => {
    const rule = { ...base, frequency: "SEMIMONTHLY" as const, anchorDays: [1, 15], startDate: "2026-01-01" };
    const results = expandRule(rule, "2026-01-01", "2026-01-31");
    expect(results.map(r => r.date)).toEqual(["2026-01-01", "2026-01-15"]);
  });
});

describe("expandRule - QUARTERLY", () => {
  it("generates every 3 months from start month", () => {
    const rule = { ...base, frequency: "QUARTERLY" as const, anchorDays: [1], startDate: "2026-01-01" };
    const results = expandRule(rule, "2026-01-01", "2026-12-31");
    expect(results.map(r => r.date)).toEqual(["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"]);
  });
});

describe("expandRule - WEEKLY", () => {
  it("generates every 7 days on the specified day of week", () => {
    // 2026-03-09 is a Monday (dayOfWeek=1)
    const rule = { ...base, frequency: "WEEKLY" as const, anchorDays: [1], startDate: "2026-03-09" };
    const results = expandRule(rule, "2026-03-09", "2026-03-30");
    expect(results.map(r => r.date)).toEqual(["2026-03-09", "2026-03-16", "2026-03-23", "2026-03-30"]);
  });
});

describe("expandRule - BIWEEKLY", () => {
  it("generates every 14 days anchored from startDate", () => {
    const rule = { ...base, frequency: "BIWEEKLY" as const, anchorDays: [1], startDate: "2026-03-09" };
    const results = expandRule(rule, "2026-03-09", "2026-04-06");
    expect(results.map(r => r.date)).toEqual(["2026-03-09", "2026-03-23", "2026-04-06"]);
  });
});

describe("expandRule - YEARLY", () => {
  it("generates once per year on startDate month+day", () => {
    const rule = { ...base, frequency: "YEARLY" as const, anchorDays: [], startDate: "2026-03-15" };
    const results = expandRule(rule, "2026-01-01", "2028-12-31");
    expect(results.map(r => r.date)).toEqual(["2026-03-15", "2027-03-15", "2028-03-15"]);
  });
});

describe("expandRule - YEARLY leap year clamp", () => {
  it("clamps Feb 29 to Feb 28 in non-leap years", () => {
    const rule = { ...base, frequency: "YEARLY" as const, anchorDays: [], startDate: "2024-02-29" };
    const results = expandRule(rule, "2024-01-01", "2026-12-31");
    expect(results.map(r => r.date)).toEqual(["2024-02-29", "2025-02-28", "2026-02-28"]);
  });
});

describe("expandRule - WEEKLY guard", () => {
  it("returns empty array for out-of-range day of week", () => {
    const rule = { ...base, frequency: "WEEKLY" as const, anchorDays: [7], startDate: "2026-01-01" };
    const results = expandRule(rule, "2026-01-01", "2026-01-31");
    expect(results).toEqual([]);
  });
});

describe("expandRule - MONTHLY anchor day clamping", () => {
  it("clamps day 31 to last day of short months", () => {
    const rule = { ...base, frequency: "MONTHLY" as const, anchorDays: [31], startDate: "2026-01-01" };
    const results = expandRule(rule, "2026-01-01", "2026-04-30");
    expect(results.map(r => r.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
});

describe("expandRule - inactive rule", () => {
  it("returns empty array when active is false", () => {
    const rule = { ...base, frequency: "MONTHLY" as const, anchorDays: [1], startDate: "2026-01-01", active: false };
    const results = expandRule(rule, "2026-01-01", "2026-12-31");
    expect(results).toEqual([]);
  });
});
