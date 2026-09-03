/**
 * VEEKAY Payroll Calculation Engine
 *
 * This is the single authoritative source of payroll math. It is pure
 * (no I/O) and deterministic: given the same inputs it always produces the
 * same output. Nothing in the frontend or elsewhere in the backend may
 * duplicate these formulas.
 */

export const MONTHLY_PAID_LEAVE_DAYS = 1;

export class PayrollValidationError extends Error {}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Rounds a rupee amount to the nearest 10, matching the factory's manual
 * convention: a remainder under 5 rounds down (truncates to the lower 10),
 * a remainder of 5 or more rounds up to the next 10.
 * e.g. 6695 -> 6700 (remainder 5, rounds up), 3032 -> 3030 (remainder 2, rounds down).
 */
export function roundToNearest10(n: number): number {
  const rounded = Math.round(n);
  const remainder = ((rounded % 10) + 10) % 10;
  return remainder < 5 ? rounded - remainder : rounded + (10 - remainder);
}

// ------------------------------------------------------------------
// Attendance-derived fields (per employee)
// ------------------------------------------------------------------

export interface AttendanceDerivedInput {
  workingDays: number;
  presentDays: number;
  actualAbsentDays: number;
  /**
   * Whether this employee is entitled to the 1-day-per-month absence
   * forgiveness. Opt-in per employee — when false, every absent day is
   * deductible (matching the factory's manual register).
   */
  paidLeaveApplicable: boolean;
}

export interface AttendanceDerivedResult {
  paidLeave: number;
  paidLeaveUsed: number;
  deductibleAbsentDays: number;
  payableDays: number;
}

export function computeAttendanceDerivedFields(input: AttendanceDerivedInput): AttendanceDerivedResult {
  const { workingDays, presentDays, actualAbsentDays, paidLeaveApplicable } = input;

  if (workingDays < 0) throw new PayrollValidationError("Working days cannot be negative");
  if (presentDays < 0) throw new PayrollValidationError("Present days cannot be negative");
  if (actualAbsentDays < 0) throw new PayrollValidationError("Actual absent days cannot be negative");
  if (presentDays > workingDays) throw new PayrollValidationError("Present days cannot exceed working days");

  const paidLeave = paidLeaveApplicable ? MONTHLY_PAID_LEAVE_DAYS : 0;
  const paidLeaveUsed = Math.min(actualAbsentDays, paidLeave);
  const deductibleAbsentDays = Math.max(actualAbsentDays - paidLeaveUsed, 0);
  const payableDays = workingDays - deductibleAbsentDays;

  return { paidLeave, paidLeaveUsed, deductibleAbsentDays, payableDays };
}

// ------------------------------------------------------------------
// Salary after absence
// ------------------------------------------------------------------

export interface SalaryAfterAbsenceResult {
  dailySalary: number;
  absenceDeduction: number;
  salaryAfterAbsence: number;
}

export function computeSalaryAfterAbsence(
  monthlySalary: number,
  workingDays: number,
  deductibleAbsentDays: number
): SalaryAfterAbsenceResult {
  if (monthlySalary < 0) throw new PayrollValidationError("Monthly salary cannot be negative");
  if (workingDays <= 0) {
    return { dailySalary: 0, absenceDeduction: 0, salaryAfterAbsence: round2(monthlySalary) };
  }
  const dailySalary = monthlySalary / workingDays;
  const absenceDeduction = round2(dailySalary * deductibleAbsentDays);
  const salaryAfterAbsence = round2(monthlySalary - absenceDeduction);
  return { dailySalary: round2(dailySalary), absenceDeduction, salaryAfterAbsence };
}

// ------------------------------------------------------------------
// Full attendance bonus
//
// IMPORTANT: using the monthly paid leave to avoid a salary deduction
// does NOT make the employee eligible for the bonus. Eligibility
// requires zero actual absences in the month (Working Days is the full
// calendar month, so it is not used as the attendance target here).
// ------------------------------------------------------------------

export interface BonusRuleConfig {
  enabled: boolean;
  amount: number;
}

export function computeBonusEligibility(actualAbsentDays: number): boolean {
  return actualAbsentDays === 0;
}

export function computeBonus(bonusRule: BonusRuleConfig | null, isEligible: boolean): number {
  if (!bonusRule || !bonusRule.enabled || !isEligible) return 0;
  return round2(bonusRule.amount);
}

// ------------------------------------------------------------------
// Statutory deductions — PF, ESI, PT
// All rates/slabs/ceilings are rule-driven; nothing is hard-coded here.
// ------------------------------------------------------------------

export interface PfRuleConfig {
  enabled: boolean;
  ratePercent: number;
  wageCeiling: number | null;
}

// PF is charged on Basic Salary prorated for days actually present in the
// month — not the full monthly Basic — then rounded to the nearest rupee:
//   PF = ROUND(Basic Salary / Working Days * Present Days * Rate%)
// Verified against the factory's own calculation for Vallala Prakash:
// 14000 / 31 * 30 * 12% = 1625.806... -> Rs.1626.
export function computePf(
  rule: PfRuleConfig | null,
  applicable: boolean,
  basicSalary: number,
  workingDays: number,
  presentDays: number
): number {
  if (!applicable || !rule || !rule.enabled) return 0;
  if (workingDays <= 0) return 0;
  const cappedBasic = rule.wageCeiling != null ? Math.min(basicSalary, rule.wageCeiling) : basicSalary;
  const proRatedBasic = (cappedBasic / workingDays) * presentDays;
  return Math.round(proRatedBasic * (rule.ratePercent / 100));
}

export interface EsiRuleConfig {
  enabled: boolean;
  ratePercent: number;
  wageCeiling: number | null;
}

export function computeEsi(rule: EsiRuleConfig | null, applicable: boolean, wageBase: number): number {
  if (!applicable || !rule || !rule.enabled) return 0;
  if (rule.wageCeiling != null && wageBase > rule.wageCeiling) return 0; // ESI eligibility typically caps out entirely above ceiling
  return round2(wageBase * (rule.ratePercent / 100));
}

export interface PtSlabConfig {
  minSalary: number;
  maxSalary: number | null;
  ptAmount: number;
}

export function computePt(slabs: PtSlabConfig[], applicable: boolean, wageBase: number): number {
  if (!applicable || slabs.length === 0) return 0;
  const slab = slabs.find((s) => wageBase >= s.minSalary && (s.maxSalary == null || wageBase <= s.maxSalary));
  return slab ? round2(slab.ptAmount) : 0;
}

// ------------------------------------------------------------------
// Over-Time / Late Hours (Register of Wages format)
//
// dailyRate is the same per-day rate used for absence deduction (Monthly
// Salary / Working Days), rounded to the nearest rupee. otDays is entered
// manually by the admin (fractional days allowed). The resulting amount is
// rounded to the nearest 10 rupees and added into Total Earnings.
// ------------------------------------------------------------------

export function computeDailyRate(monthlySalary: number, workingDays: number): number {
  if (workingDays <= 0) return 0;
  return Math.round(monthlySalary / workingDays);
}

export function computeOvertimeAmount(otDays: number, dailyRate: number): number {
  if (otDays <= 0) return 0;
  return roundToNearest10(otDays * dailyRate);
}

// ------------------------------------------------------------------
// Full pipeline
// ------------------------------------------------------------------

export interface EmployeePayrollInput {
  basicSalary: number;
  monthlySalary: number;
  workingDays: number;
  presentDays: number;
  actualAbsentDays: number;
  advanceAmount: number;
  canteenCharges: number;
  otDays: number;
  otherAmount: number;
  paidLeaveApplicable: boolean;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  bonusRule: BonusRuleConfig | null;
  pfRule: PfRuleConfig | null;
  esiRule: EsiRuleConfig | null;
  ptSlabs: PtSlabConfig[];
}

export interface EmployeePayrollResult {
  workingDays: number;
  presentDays: number;
  actualAbsentDays: number;
  paidLeave: number;
  paidLeaveUsed: number;
  deductibleAbsentDays: number;
  payableDays: number;

  absenceDeduction: number;
  salaryAfterAbsence: number;
  bonusEligible: boolean;
  bonus: number;
  dailyRate: number;
  otDays: number;
  otAmount: number;
  otherAmount: number;
  totalEarnings: number;

  esi: number;
  pf: number;
  pt: number;
  advance: number;
  canteenCharges: number;
  totalDeductions: number;

  netSalary: number;
}

export function calculateEmployeePayroll(input: EmployeePayrollInput): EmployeePayrollResult {
  if (input.advanceAmount < 0) throw new PayrollValidationError("Advance cannot be negative");
  if (input.canteenCharges < 0) throw new PayrollValidationError("Canteen charges cannot be negative");
  if (input.otDays < 0) throw new PayrollValidationError("OT days cannot be negative");
  if (input.otherAmount < 0) throw new PayrollValidationError("Other amount cannot be negative");

  const { paidLeave, paidLeaveUsed, deductibleAbsentDays, payableDays } = computeAttendanceDerivedFields({
    workingDays: input.workingDays,
    presentDays: input.presentDays,
    actualAbsentDays: input.actualAbsentDays,
    paidLeaveApplicable: input.paidLeaveApplicable,
  });

  const { absenceDeduction, salaryAfterAbsence } = computeSalaryAfterAbsence(
    input.monthlySalary,
    input.workingDays,
    deductibleAbsentDays
  );

  const bonusEligible = computeBonusEligibility(input.actualAbsentDays);
  const bonus = computeBonus(input.bonusRule, bonusEligible);

  const dailyRate = computeDailyRate(input.monthlySalary, input.workingDays);
  const otAmount = computeOvertimeAmount(input.otDays, dailyRate);

  const otherAmount = round2(input.otherAmount);
  const totalEarnings = roundToNearest10(salaryAfterAbsence + bonus + otAmount + otherAmount);

  // PF is levied on Basic Salary prorated by days present (see computePf).
  // ESI is levied on Salary After Absence — the Rate of Pay after the
  // absentee deduction, excluding bonus/OT.
  const pf = computePf(input.pfRule, input.pfApplicable, input.basicSalary, input.workingDays, input.presentDays);
  const esi = computeEsi(input.esiRule, input.esiApplicable, salaryAfterAbsence);
  // Professional Tax is levied on the full contracted Rate of Pay, not on
  // the absence-adjusted amount — verified against the factory's register
  // (a worker on Rs.21,000/month still pays the Rs.200 slab in a month where
  // absences cut his earned salary to Rs.10,161).
  const pt = computePt(input.ptSlabs, input.ptApplicable, input.monthlySalary);
  const advance = round2(input.advanceAmount);
  const canteenCharges = round2(input.canteenCharges);

  const totalDeductions = round2(esi + pf + pt + advance + canteenCharges);
  const netSalary = roundToNearest10(totalEarnings - totalDeductions);

  return {
    workingDays: input.workingDays,
    presentDays: input.presentDays,
    actualAbsentDays: input.actualAbsentDays,
    paidLeave,
    paidLeaveUsed,
    deductibleAbsentDays,
    payableDays,
    absenceDeduction,
    salaryAfterAbsence,
    bonusEligible,
    bonus,
    dailyRate,
    otDays: input.otDays,
    otAmount,
    otherAmount,
    totalEarnings,
    esi,
    pf,
    pt,
    advance,
    canteenCharges,
    totalDeductions,
    netSalary,
  };
}
