import { expandRule, RuleInput } from "./recurringExpansion";

export interface MatchCandidate {
  transaction: { id: string; date: string; name: string; amount: number };
  rule: { id: string; name: string };
  projectedDate: string;
  confidence: number;
}

function daysDiff(a: string, b: string): number {
  const diff = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const wordsA = new Set(na.split(/\s+/).filter(Boolean));
  const wordsB = new Set(nb.split(/\s+/).filter(Boolean));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

export function findMatches(
  transactions: Array<{ id: string; date: string; name: string; amount: number; reconciled: boolean }>,
  rules: RuleInput[],
  alreadyMatchedTransactionIds: Set<string>
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  const DATE_WINDOW = 3;
  const AMOUNT_TOLERANCE = 0.05;

  for (const txn of transactions) {
    if (txn.reconciled) continue;
    if (alreadyMatchedTransactionIds.has(txn.id)) continue;

    for (const rule of rules) {
      if (!rule.active) continue;

      // Expand a small window around the transaction date
      const windowStart = new Date(txn.date + "T00:00:00Z");
      windowStart.setUTCDate(windowStart.getUTCDate() - DATE_WINDOW);
      const windowEnd = new Date(txn.date + "T00:00:00Z");
      windowEnd.setUTCDate(windowEnd.getUTCDate() + DATE_WINDOW);

      const occurrences = expandRule(
        rule,
        windowStart.toISOString().slice(0, 10),
        windowEnd.toISOString().slice(0, 10)
      );

      for (const occ of occurrences) {
        const ruleAbsAmount = Math.abs(occ.amount);
        if (ruleAbsAmount === 0) continue;
        const amountDiff = Math.abs(Math.abs(txn.amount) - ruleAbsAmount) / ruleAbsAmount;
        if (amountDiff > AMOUNT_TOLERANCE) continue;

        const dayDiff = daysDiff(txn.date, occ.date);
        const nameSim = nameSimilarity(txn.name, rule.name);
        const confidence =
          (1 - dayDiff / (DATE_WINDOW + 1)) * 0.4 +
          nameSim * 0.4 +
          (1 - amountDiff) * 0.2;

        if (confidence >= 0.5) {
          candidates.push({
            transaction: { id: txn.id, date: txn.date, name: txn.name, amount: txn.amount },
            rule: { id: rule.id, name: rule.name },
            projectedDate: occ.date,
            confidence: Math.round(confidence * 100) / 100,
          });
        }
      }
    }
  }

  // Sort by confidence descending, keep best match per transaction
  candidates.sort((a, b) => b.confidence - a.confidence);
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.transaction.id)) return false;
    seen.add(c.transaction.id);
    return true;
  });
}
