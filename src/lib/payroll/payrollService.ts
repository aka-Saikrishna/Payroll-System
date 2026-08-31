import { prisma } from "@/lib/prisma";
import { Prisma, PayrollStatus } from "@prisma/client";
import { computeCalendarBreakdown } from "./period";
import { resolveApplicableRule, resolveApplicablePtSlabs } from "./rules";
import { calculateEmployeePayroll, computeOvertimeAmount, roundToNearest10 } from "./engine";
import { writeAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api-helpers";

function toNum(d: Prisma.Decimal | number | null | undefined): number {
  if (d == null) return 0;
  return typeof d === "number" ? d : Number(d);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Looks up a payroll period by id, throwing a clean user-facing error
 * instead of Prisma's raw "No PayrollPeriod found" message if it no
 * longer exists (e.g. the browser held a stale id from before the
 * period was reset/regenerated).
 */
async function findPeriodOrThrow(payrollPeriodId: string) {
  const period = await prisma.payrollPeriod.findUnique({ where: { id: payrollPeriodId } });
  if (!period) {
    throw new ApiError(404, "This payroll period could not be found. Please refresh the page and try again.");
  }
  return period;
}

/**
 * Cash/cheque split for disbursing Net Salary. Defaults to fully cash.
 * If a cheque amount was already set on a prior generation/recalculation,
 * it's preserved (clamped to the new Net Salary) instead of being reset,
 * so a routine attendance edit doesn't wipe out someone's payment split.
 */
function computePaymentSplit(netSalary: number, existingChequeAmount: number | null) {
  const chequeAmount = round2(Math.min(Math.max(existingChequeAmount ?? 0, 0), netSalary));
  const cashAmount = round2(netSalary - chequeAmount);
  return { cashAmount, chequeAmount };
}

async function loadRuleSet(asOf: Date) {
  const [pfRules, esiRules, ptRules, rttRules, bonusRules] = await Promise.all([
    prisma.pfRule.findMany(),
    prisma.esiRule.findMany(),
    prisma.ptRule.findMany(),
    prisma.rttRule.findMany(),
    prisma.bonusRule.findMany(),
  ]);

  const pfRule = resolveApplicableRule(
    pfRules.map((r) => ({ ...r, ratePercent: toNum(r.ratePercent), wageCeiling: r.wageCeiling != null ? toNum(r.wageCeiling) : null })),
    asOf
  );
  const esiRule = resolveApplicableRule(
    esiRules.map((r) => ({ ...r, ratePercent: toNum(r.ratePercent), wageCeiling: r.wageCeiling != null ? toNum(r.wageCeiling) : null })),
    asOf
  );
  const rttRule = resolveApplicableRule(
    rttRules.map((r) => ({ ...r, amount: toNum(r.amount) })),
    asOf
  );
  const bonusRule = resolveApplicableRule(
    bonusRules.map((r) => ({ ...r, amount: toNum(r.amount) })),
    asOf
  );
  const ptSlabs = resolveApplicablePtSlabs(
    ptRules.map((r) => ({
      ...r,
      minSalary: toNum(r.minSalary),
      maxSalary: r.maxSalary != null ? toNum(r.maxSalary) : null,
      ptAmount: toNum(r.ptAmount),
    })),
    asOf
  ).sort((a, b) => toNum(a.minSalary) - toNum(b.minSalary));

  return { pfRule, esiRule, ptSlabs, rttRule, bonusRule };
}

async function computeAttendanceCounts(employeeId: string, monthStart: Date, monthEnd: Date) {
  const records = await prisma.attendance.findMany({
    where: { employeeId, attendanceDate: { gte: monthStart, lte: monthEnd } },
  });
  const presentDays = records.filter((r) => r.status === "PRESENT").length;
  const actualAbsentDays = records.filter((r) => r.status === "ABSENT").length;
  return { presentDays, actualAbsentDays };
}

async function computeAdvanceAmount(employeeId: string, payrollPeriodId: string, monthStart: Date, monthEnd: Date) {
  const advances = await prisma.salaryAdvance.findMany({
    where: {
      employeeId,
      OR: [{ payrollPeriodId }, { payrollPeriodId: null, advanceDate: { gte: monthStart, lte: monthEnd } }],
    },
  });
  return advances.reduce((sum, a) => sum + toNum(a.amount), 0);
}

export async function generatePayrollForPeriod(payrollPeriodId: string, userId: string | null, company: string = "VPPL") {
  const period = await findPeriodOrThrow(payrollPeriodId);
  if (period.status === "FINALIZED") {
    throw new ApiError(409, "Payroll period is finalized. Reopen it before regenerating.");
  }

  const monthStart = new Date(Date.UTC(period.year, period.month - 1, 1));
  const monthEnd = new Date(Date.UTC(period.year, period.month, 0));

  const [employees, ruleSet, allAttendance, allAdvances, allExisting] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE", company },
      include: { salaryConfig: true },
    }),
    loadRuleSet(monthEnd),
    prisma.attendance.findMany({
      where: { attendanceDate: { gte: monthStart, lte: monthEnd }, employee: { status: "ACTIVE", company } },
      select: { employeeId: true, status: true },
    }),
    prisma.salaryAdvance.findMany({
      where: {
        employee: { status: "ACTIVE", company },
        OR: [{ payrollPeriodId }, { payrollPeriodId: null, advanceDate: { gte: monthStart, lte: monthEnd } }],
      },
      select: { employeeId: true, amount: true },
    }),
    prisma.payrollRecord.findMany({
      where: { payrollPeriodId, employee: { status: "ACTIVE", company } },
      select: { employeeId: true, chequeAmount: true, canteenCharges: true, otDays: true },
    }),
  ]);

  const attendanceByEmployee = new Map<string, { present: number; absent: number }>();
  for (const rec of allAttendance) {
    const entry = attendanceByEmployee.get(rec.employeeId) ?? { present: 0, absent: 0 };
    if (rec.status === "PRESENT") entry.present++;
    else if (rec.status === "ABSENT") entry.absent++;
    attendanceByEmployee.set(rec.employeeId, entry);
  }

  const advanceByEmployee = new Map<string, number>();
  for (const adv of allAdvances) {
    advanceByEmployee.set(adv.employeeId, (advanceByEmployee.get(adv.employeeId) ?? 0) + toNum(adv.amount));
  }

  const existingByEmployee = new Map(allExisting.map((e) => [e.employeeId, e]));

  const upserts: Prisma.PrismaPromise<unknown>[] = [];
  let processed = 0;

  for (const employee of employees) {
    if (!employee.salaryConfig) continue;

    const counts = attendanceByEmployee.get(employee.id) ?? { present: 0, absent: 0 };
    const advanceAmount = advanceByEmployee.get(employee.id) ?? 0;
    const existing = existingByEmployee.get(employee.id);

    const result = calculateEmployeePayroll({
      basicSalary: toNum(employee.salaryConfig.basicSalary),
      monthlySalary: toNum(employee.salaryConfig.monthlySalary),
      workingDays: period.workingDays,
      presentDays: counts.present,
      actualAbsentDays: counts.absent,
      advanceAmount,
      canteenCharges: existing ? toNum(existing.canteenCharges) : 0,
      otDays: existing ? toNum(existing.otDays) : 0,
      paidLeaveApplicable: employee.salaryConfig.paidLeaveApplicable,
      pfApplicable: employee.salaryConfig.pfApplicable,
      esiApplicable: employee.salaryConfig.esiApplicable,
      ptApplicable: employee.salaryConfig.ptApplicable,
      rttApplicable: employee.salaryConfig.rttApplicable,
      bonusRule: ruleSet.bonusRule,
      pfRule: ruleSet.pfRule,
      esiRule: ruleSet.esiRule,
      ptSlabs: ruleSet.ptSlabs,
      rttRule: ruleSet.rttRule,
    });

    const { cashAmount, chequeAmount } = computePaymentSplit(result.netSalary, existing ? toNum(existing.chequeAmount) : null);

    const salarySnapshot = {
      basicSalary: employee.salaryConfig.basicSalary,
      hra: employee.salaryConfig.hra,
      conveyance: employee.salaryConfig.conveyance,
      monthlySalary: employee.salaryConfig.monthlySalary,
    };

    const recordData = {
      ...salarySnapshot,
      workingDays: result.workingDays,
      presentDays: result.presentDays,
      actualAbsentDays: result.actualAbsentDays,
      paidLeave: result.paidLeave,
      paidLeaveUsed: result.paidLeaveUsed,
      deductibleAbsentDays: result.deductibleAbsentDays,
      payableDays: result.payableDays,
      absenceDeduction: result.absenceDeduction,
      salaryAfterAbsence: result.salaryAfterAbsence,
      bonusEligible: result.bonusEligible,
      bonus: result.bonus,
      dailyRate: result.dailyRate,
      otDays: result.otDays,
      otAmount: result.otAmount,
      totalEarnings: result.totalEarnings,
      esi: result.esi,
      pf: result.pf,
      pt: result.pt,
      rtt: result.rtt,
      advance: result.advance,
      canteenCharges: result.canteenCharges,
      totalDeductions: result.totalDeductions,
      netSalary: result.netSalary,
      cashAmount,
      chequeAmount,
      appliedPfRateId: ruleSet.pfRule?.id ?? null,
      appliedEsiRuleId: ruleSet.esiRule?.id ?? null,
      appliedRttRuleId: ruleSet.rttRule?.id ?? null,
      appliedBonusRuleId: ruleSet.bonusRule?.id ?? null,
      status: "REVIEW" as PayrollStatus,
    };

    upserts.push(
      prisma.payrollRecord.upsert({
        where: { payrollPeriodId_employeeId: { payrollPeriodId, employeeId: employee.id } },
        create: { payrollPeriodId, employeeId: employee.id, ...recordData },
        update: recordData,
      })
    );
    processed++;
  }

  upserts.push(prisma.payrollPeriod.update({ where: { id: payrollPeriodId }, data: { status: "REVIEW" } }));
  await prisma.$transaction(upserts);

  writeAuditLog({
    userId,
    action: "PAYROLL_GENERATED",
    entity: "PayrollPeriod",
    entityId: payrollPeriodId,
    newValue: { employeesProcessed: processed },
  });

  return { employeesProcessed: processed };
}

export async function recalculateSingleEmployeePayroll(payrollPeriodId: string, employeeId: string, userId: string | null) {
  const [period, employee] = await Promise.all([
    findPeriodOrThrow(payrollPeriodId),
    prisma.employee.findUnique({ where: { id: employeeId }, include: { salaryConfig: true } }),
  ]);
  if (period.status === "FINALIZED") {
    throw new ApiError(409, "Payroll period is finalized. Reopen it before recalculating.");
  }
  if (!employee) throw new ApiError(404, "This employee could not be found. Please refresh the page and try again.");
  if (!employee.salaryConfig) throw new ApiError(400, "Employee has no payroll configuration");

  const monthStart = new Date(Date.UTC(period.year, period.month - 1, 1));
  const monthEnd = new Date(Date.UTC(period.year, period.month, 0));

  const [ruleSet, { presentDays, actualAbsentDays }, advanceAmount, existing] = await Promise.all([
    loadRuleSet(monthEnd),
    computeAttendanceCounts(employeeId, monthStart, monthEnd),
    computeAdvanceAmount(employeeId, payrollPeriodId, monthStart, monthEnd),
    prisma.payrollRecord.findUnique({
      where: { payrollPeriodId_employeeId: { payrollPeriodId, employeeId } },
      select: { chequeAmount: true, canteenCharges: true, otDays: true },
    }),
  ]);

  const result = calculateEmployeePayroll({
    basicSalary: toNum(employee.salaryConfig.basicSalary),
    monthlySalary: toNum(employee.salaryConfig.monthlySalary),
    workingDays: period.workingDays,
    presentDays,
    actualAbsentDays,
    advanceAmount,
    canteenCharges: existing ? toNum(existing.canteenCharges) : 0,
    otDays: existing ? toNum(existing.otDays) : 0,
    paidLeaveApplicable: employee.salaryConfig.paidLeaveApplicable,
    pfApplicable: employee.salaryConfig.pfApplicable,
    esiApplicable: employee.salaryConfig.esiApplicable,
    ptApplicable: employee.salaryConfig.ptApplicable,
    rttApplicable: employee.salaryConfig.rttApplicable,
    bonusRule: ruleSet.bonusRule,
    pfRule: ruleSet.pfRule,
    esiRule: ruleSet.esiRule,
    ptSlabs: ruleSet.ptSlabs,
    rttRule: ruleSet.rttRule,
  });

  const { cashAmount, chequeAmount } = computePaymentSplit(result.netSalary, existing ? toNum(existing.chequeAmount) : null);

  const salarySnapshot = {
    basicSalary: employee.salaryConfig.basicSalary,
    hra: employee.salaryConfig.hra,
    conveyance: employee.salaryConfig.conveyance,
    monthlySalary: employee.salaryConfig.monthlySalary,
  };

  const record = await prisma.payrollRecord.upsert({
    where: { payrollPeriodId_employeeId: { payrollPeriodId, employeeId } },
    create: {
      payrollPeriodId,
      employeeId,
      ...salarySnapshot,
      ...result,
      cashAmount,
      chequeAmount,
      appliedPfRateId: ruleSet.pfRule?.id ?? null,
      appliedEsiRuleId: ruleSet.esiRule?.id ?? null,
      appliedRttRuleId: ruleSet.rttRule?.id ?? null,
      appliedBonusRuleId: ruleSet.bonusRule?.id ?? null,
      status: "REVIEW",
    },
    update: {
      ...salarySnapshot,
      ...result,
      cashAmount,
      chequeAmount,
      appliedPfRateId: ruleSet.pfRule?.id ?? null,
      appliedEsiRuleId: ruleSet.esiRule?.id ?? null,
      appliedRttRuleId: ruleSet.rttRule?.id ?? null,
      appliedBonusRuleId: ruleSet.bonusRule?.id ?? null,
    },
  });

  writeAuditLog({
    userId,
    action: "PAYROLL_RECALCULATED",
    entity: "PayrollRecord",
    entityId: record.id,
    newValue: { netSalary: result.netSalary },
  });

  return record;
}

/**
 * Edits the manually-entered Canteen Charges and OT Days on an already
 * generated payroll record, recomputing OT Amount / Total Earnings / Total
 * Deductions / Net Salary (and re-clamping the cash/cheque split) without
 * needing to reload attendance or rules, since none of those changed.
 */
export async function updatePayrollExtras(
  payrollRecordId: string,
  extras: { canteenCharges: number; otDays: number },
  userId: string | null
) {
  if (extras.canteenCharges < 0) throw new ApiError(400, "Canteen charges cannot be negative");
  if (extras.otDays < 0) throw new ApiError(400, "OT days cannot be negative");

  const record = await prisma.payrollRecord.findUnique({
    where: { id: payrollRecordId },
    include: { payrollPeriod: true },
  });
  if (!record) throw new ApiError(404, "Payroll record not found");
  if (record.payrollPeriod.status === "FINALIZED") {
    throw new ApiError(409, "Payroll is finalized. Reopen the period before editing.");
  }

  const otAmount = computeOvertimeAmount(extras.otDays, toNum(record.dailyRate));
  const totalEarnings = roundToNearest10(toNum(record.salaryAfterAbsence) + toNum(record.bonus) + otAmount);
  const totalDeductions = round2(
    toNum(record.esi) + toNum(record.pf) + toNum(record.pt) + toNum(record.rtt) + toNum(record.advance) + extras.canteenCharges
  );
  const netSalary = roundToNearest10(totalEarnings - totalDeductions);
  const { cashAmount, chequeAmount } = computePaymentSplit(netSalary, toNum(record.chequeAmount));

  const updated = await prisma.payrollRecord.update({
    where: { id: payrollRecordId },
    data: {
      otDays: extras.otDays,
      otAmount,
      canteenCharges: extras.canteenCharges,
      totalEarnings,
      totalDeductions,
      netSalary,
      cashAmount,
      chequeAmount,
    },
  });

  writeAuditLog({
    userId,
    action: "PAYROLL_EXTRAS_UPDATED",
    entity: "PayrollRecord",
    entityId: record.id,
    oldValue: { canteenCharges: record.canteenCharges, otDays: record.otDays },
    newValue: extras,
  });

  return updated;
}

export async function finalizePayrollPeriod(payrollPeriodId: string, userId: string) {
  const period = await findPeriodOrThrow(payrollPeriodId);
  if (period.status === "FINALIZED") throw new ApiError(409, "Already finalized");

  await prisma.$transaction([
    prisma.payrollRecord.updateMany({ where: { payrollPeriodId }, data: { status: "FINALIZED" } }),
    prisma.payrollPeriod.update({
      where: { id: payrollPeriodId },
      data: { status: "FINALIZED", finalizedAt: new Date(), finalizedById: userId },
    }),
  ]);

  await writeAuditLog({ userId, action: "PAYROLL_FINALIZED", entity: "PayrollPeriod", entityId: payrollPeriodId });
}

export async function reopenPayrollPeriod(payrollPeriodId: string, userId: string, reason: string) {
  const period = await findPeriodOrThrow(payrollPeriodId);
  if (period.status !== "FINALIZED") throw new ApiError(409, "Only finalized payroll can be reopened");

  await prisma.$transaction([
    prisma.payrollRecord.updateMany({ where: { payrollPeriodId }, data: { status: "REVIEW" } }),
    prisma.payrollPeriod.update({
      where: { id: payrollPeriodId },
      data: { status: "REVIEW", finalizedAt: null, finalizedById: null },
    }),
  ]);

  await writeAuditLog({
    userId,
    action: "PAYROLL_REOPENED",
    entity: "PayrollPeriod",
    entityId: payrollPeriodId,
    newValue: { reason },
  });
}

export { computeCalendarBreakdown };
