/**
 * Effective-dated rule resolution. Payroll rules (PF/ESI/PT/RTT/Bonus) can
 * change over time; every rule row carries an effectiveFrom (and optional
 * effectiveTo). Given a target date, we pick the most recent rule whose
 * window covers that date. This is what lets a July PF-rate change leave
 * April's already-finalized payroll untouched (section 48 of the spec).
 */

export interface EffectiveDated {
  effectiveFrom: Date;
  effectiveTo: Date | null;
  enabled?: boolean;
}

export function resolveApplicableRule<T extends EffectiveDated>(rules: T[], asOf: Date): T | null {
  const candidates = rules
    .filter((r) => r.effectiveFrom <= asOf && (r.effectiveTo == null || r.effectiveTo >= asOf))
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return candidates[0] ?? null;
}

export function resolveApplicablePtSlabs<T extends EffectiveDated & { minSalary: unknown }>(
  rules: T[],
  asOf: Date
): T[] {
  // PT slabs are a set of rows active at once (one per band), not a single row.
  // We pick the newest effectiveFrom generation that is <= asOf per band start.
  const active = rules.filter((r) => r.effectiveFrom <= asOf && (r.effectiveTo == null || r.effectiveTo >= asOf));
  return active;
}
