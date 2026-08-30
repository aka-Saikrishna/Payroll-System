import { describe, expect, it } from "vitest";
import {
  calculateEmployeePayroll,
  computeAttendanceDerivedFields,
  computeBonus,
  computeBonusEligibility,
  computeDailyRate,
  computeEsi,
  computeOvertimeAmount,
  computePf,
  computePt,
  computeRtt,
  computeSalaryAfterAbsence,
  PayrollValidationError,
  roundToNearest10,
} from "./engine";

describe("computeAttendanceDerivedFields — monthly paid leave rule", () => {
  it("0 absence: paid leave unused, nothing deductible", () => {
    const r = computeAttendanceDerivedFields({ workingDays: 25, presentDays: 25, actualAbsentDays: 0, paidLeaveApplicable: true });
    expect(r).toEqual({ paidLeave: 1, paidLeaveUsed: 0, deductibleAbsentDays: 0, payableDays: 25 });
  });

  it("1 absence: fully absorbed by paid leave", () => {
    const r = computeAttendanceDerivedFields({ workingDays: 25, presentDays: 24, actualAbsentDays: 1, paidLeaveApplicable: true });
    expect(r).toEqual({ paidLeave: 1, paidLeaveUsed: 1, deductibleAbsentDays: 0, payableDays: 25 });
  });

  it("2 absence: 1 covered, 1 deductible", () => {
    const r = computeAttendanceDerivedFields({ workingDays: 25, presentDays: 23, actualAbsentDays: 2, paidLeaveApplicable: true });
    expect(r).toEqual({ paidLeave: 1, paidLeaveUsed: 1, deductibleAbsentDays: 1, payableDays: 24 });
  });

  it("4 absence: 1 covered, 3 deductible (spec example)", () => {
    const r = computeAttendanceDerivedFields({ workingDays: 25, presentDays: 21, actualAbsentDays: 4, paidLeaveApplicable: true });
    expect(r).toEqual({ paidLeave: 1, paidLeaveUsed: 1, deductibleAbsentDays: 3, payableDays: 22 });
  });

  it("never produces negative deductible absence", () => {
    const r = computeAttendanceDerivedFields({ workingDays: 25, presentDays: 25, actualAbsentDays: 0, paidLeaveApplicable: true });
    expect(r.deductibleAbsentDays).toBeGreaterThanOrEqual(0);
  });

  it("rejects present days exceeding working days", () => {
    expect(() =>
      computeAttendanceDerivedFields({ workingDays: 25, presentDays: 26, actualAbsentDays: 0, paidLeaveApplicable: true })
    ).toThrow(PayrollValidationError);
  });
});

describe("computeAttendanceDerivedFields — paid leave is opt-in per employee", () => {
  it("when NOT entitled, every absent day is deductible (matches the factory register)", () => {
    const r = computeAttendanceDerivedFields({
      workingDays: 31,
      presentDays: 29,
      actualAbsentDays: 2,
      paidLeaveApplicable: false,
    });
    expect(r).toEqual({ paidLeave: 0, paidLeaveUsed: 0, deductibleAbsentDays: 2, payableDays: 29 });
  });

  it("when NOT entitled, a single absence is still deducted", () => {
    const r = computeAttendanceDerivedFields({
      workingDays: 31,
      presentDays: 30,
      actualAbsentDays: 1,
      paidLeaveApplicable: false,
    });
    expect(r.deductibleAbsentDays).toBe(1);
    expect(r.payableDays).toBe(30);
  });

  it("entitled vs not entitled differ by exactly one forgiven day", () => {
    const base = { workingDays: 31, presentDays: 29, actualAbsentDays: 2 };
    const withLeave = computeAttendanceDerivedFields({ ...base, paidLeaveApplicable: true });
    const withoutLeave = computeAttendanceDerivedFields({ ...base, paidLeaveApplicable: false });
    expect(withoutLeave.deductibleAbsentDays - withLeave.deductibleAbsentDays).toBe(1);
  });
});

describe("computeSalaryAfterAbsence", () => {
  it("spec example: 20000 salary, 25 working days, 3 deductible absent -> 2400 deduction", () => {
    const r = computeSalaryAfterAbsence(20000, 25, 3);
    expect(r.dailySalary).toBe(800);
    expect(r.absenceDeduction).toBe(2400);
    expect(r.salaryAfterAbsence).toBe(17600);
  });

  it("no deduction when deductible absence is zero", () => {
    const r = computeSalaryAfterAbsence(20000, 25, 0);
    expect(r.absenceDeduction).toBe(0);
    expect(r.salaryAfterAbsence).toBe(20000);
  });
});

describe("full attendance bonus eligibility", () => {
  it("0 actual absences -> eligible", () => {
    expect(computeBonusEligibility(0)).toBe(true);
  });

  it("1 absence (even if paid-leave covered) -> NOT eligible", () => {
    expect(computeBonusEligibility(1)).toBe(false);
  });

  it("computeBonus returns 0 when rule disabled", () => {
    expect(computeBonus({ enabled: false, amount: 200 }, true)).toBe(0);
  });

  it("computeBonus returns configured amount when eligible and enabled", () => {
    expect(computeBonus({ enabled: true, amount: 200 }, true)).toBe(200);
  });

  it("computeBonus returns 0 when not eligible even if enabled", () => {
    expect(computeBonus({ enabled: true, amount: 200 }, false)).toBe(0);
  });
});

describe("PF calculation", () => {
  it("not applicable -> 0", () => {
    expect(computePf({ enabled: true, ratePercent: 12, wageCeiling: null }, false, 20000)).toBe(0);
  });

  it("applies rate to wage base with no ceiling", () => {
    expect(computePf({ enabled: true, ratePercent: 12, wageCeiling: null }, true, 20000)).toBe(2400);
  });

  it("caps wage base at the configured ceiling", () => {
    expect(computePf({ enabled: true, ratePercent: 12, wageCeiling: 15000 }, true, 20000)).toBe(1800);
  });
});

describe("ESI calculation", () => {
  it("applies configured rate below ceiling", () => {
    expect(computeEsi({ enabled: true, ratePercent: 0.75, wageCeiling: 21000 }, true, 20000)).toBe(150);
  });

  it("returns 0 when wage exceeds ceiling (ineligible)", () => {
    expect(computeEsi({ enabled: true, ratePercent: 0.75, wageCeiling: 21000 }, true, 25000)).toBe(0);
  });
});

describe("PT slab resolution", () => {
  const slabs = [
    { minSalary: 0, maxSalary: 15000, ptAmount: 0 },
    { minSalary: 15001, maxSalary: 20000, ptAmount: 150 },
    { minSalary: 20001, maxSalary: null, ptAmount: 200 },
  ];

  it("below 15000 -> 0", () => {
    expect(computePt(slabs, true, 12000)).toBe(0);
  });

  it("15001-20000 -> 150", () => {
    expect(computePt(slabs, true, 18000)).toBe(150);
  });

  it("above 20001 -> 200", () => {
    expect(computePt(slabs, true, 25000)).toBe(200);
  });

  it("not applicable -> 0 regardless of slab", () => {
    expect(computePt(slabs, false, 25000)).toBe(0);
  });

  // PT is levied on the contracted Rate of Pay, not the absence-adjusted
  // earned salary. Verified against a real factory register (anonymized):
  //   Employee A - Rs.21,000/month, earned only Rs.10,161, still paid Rs.200
  //   Employee B - Rs.60,000/month, earned only Rs.13,548, still paid Rs.200
  // If PT were charged on earned salary both would have fallen in the Rs.0 slab.
  it("heavy absence drops earnings to 10,161 but PT still uses the 21,000 rate of pay", () => {
    const r = calculateEmployeePayroll({
      basicSalary: 21000,
      monthlySalary: 21000,
      workingDays: 31,
      presentDays: 15,
      actualAbsentDays: 16,
      advanceAmount: 0,
      canteenCharges: 650,
      otDays: 0,
      paidLeaveApplicable: false,
      pfApplicable: false,
      esiApplicable: false,
      ptApplicable: true,
      rttApplicable: false,
      bonusRule: null,
      pfRule: null,
      esiRule: null,
      ptSlabs: slabs,
      rttRule: null,
    });
    expect(Math.round(r.salaryAfterAbsence)).toBe(10161);
    expect(r.pt).toBe(200);
  });

  it("earnings of 13,548 would fall in the zero slab, but PT follows the 60,000 rate of pay", () => {
    const r = calculateEmployeePayroll({
      basicSalary: 60000,
      monthlySalary: 60000,
      workingDays: 31,
      presentDays: 7,
      actualAbsentDays: 24,
      advanceAmount: 0,
      canteenCharges: 300,
      otDays: 0,
      paidLeaveApplicable: false,
      pfApplicable: false,
      esiApplicable: false,
      ptApplicable: true,
      rttApplicable: false,
      bonusRule: null,
      pfRule: null,
      esiRule: null,
      ptSlabs: slabs,
      rttRule: null,
    });
    expect(Math.round(r.salaryAfterAbsence)).toBe(13548);
    expect(r.pt).toBe(200);
  });
});

describe("PF and ESI wage bases — PF on Basic Salary, ESI on Salary After Absence", () => {
  const pfRule = { enabled: true, ratePercent: 12, wageCeiling: null };
  const esiRule = { enabled: true, ratePercent: 0.75, wageCeiling: 21000 };
  const bonusRule = { enabled: true, amount: 200 };

  it("PF is charged on the full Basic Salary even under heavy absence, not the absence-adjusted amount", () => {
    const r = calculateEmployeePayroll({
      basicSalary: 15000,
      monthlySalary: 21000, // Basic 15000 + HRA/Conveyance 6000
      workingDays: 31,
      presentDays: 15,
      actualAbsentDays: 16,
      advanceAmount: 0,
      canteenCharges: 0,
      otDays: 0,
      paidLeaveApplicable: false,
      pfApplicable: true,
      esiApplicable: false,
      ptApplicable: false,
      rttApplicable: false,
      bonusRule: null,
      pfRule,
      esiRule: null,
      ptSlabs: [],
      rttRule: null,
    });
    expect(r.salaryAfterAbsence).toBeLessThan(15000); // earnings did drop
    expect(r.pf).toBe(1800); // 12% of the full 15000 Basic, unaffected by absence
  });

  it("ESI is charged on Salary After Absence, ignoring bonus and OT even when they'd push earnings over the ceiling", () => {
    const r = calculateEmployeePayroll({
      basicSalary: 20000,
      monthlySalary: 20000,
      workingDays: 25,
      presentDays: 25,
      actualAbsentDays: 0,
      advanceAmount: 0,
      canteenCharges: 0,
      otDays: 5,
      paidLeaveApplicable: false,
      pfApplicable: false,
      esiApplicable: true,
      ptApplicable: false,
      rttApplicable: false,
      bonusRule,
      pfRule: null,
      esiRule,
      ptSlabs: [],
      rttRule: null,
    });
    // Total Earnings (20000 + bonus + OT) exceeds the 21000 ESI ceiling, but ESI still
    // looks only at Salary After Absence (20000, under the ceiling) — proving bonus/OT
    // don't factor into the ESI wage base or its ceiling check.
    expect(r.totalEarnings).toBeGreaterThan(21000);
    expect(r.salaryAfterAbsence).toBe(20000);
    expect(r.esi).toBe(150); // 0.75% of 20000
  });
});

describe("roundToNearest10 — factory rounding convention", () => {
  it("remainder >= 5 rounds up to the next 10", () => {
    expect(roundToNearest10(6695)).toBe(6700);
    expect(roundToNearest10(5)).toBe(10);
  });

  it("remainder < 5 rounds down (truncates)", () => {
    expect(roundToNearest10(3032)).toBe(3030);
    expect(roundToNearest10(4)).toBe(0);
  });

  it("already a multiple of 10 is unchanged", () => {
    expect(roundToNearest10(3790)).toBe(3790);
    expect(roundToNearest10(7260)).toBe(7260);
    expect(roundToNearest10(0)).toBe(0);
  });
});

describe("OT / Late Hours — verified against a real Register of Wages sheet (values anonymized)", () => {
  it("daily rate = ROUND(Total Pay / Working Days), matching the sheet's per-day reference column", () => {
    expect(computeDailyRate(79166, 31)).toBe(2554);
    expect(computeDailyRate(41500, 31)).toBe(1339);
    expect(computeDailyRate(23500, 31)).toBe(758);
    expect(computeDailyRate(45000, 31)).toBe(1452);
  });

  it("5 OT days x Rs.1339 = 6695 -> rounds up to 6700", () => {
    expect(computeOvertimeAmount(5, 1339)).toBe(6700);
  });

  it("4 OT days x Rs.758 = 3032 -> rounds down to 3030", () => {
    expect(computeOvertimeAmount(4, 758)).toBe(3030);
  });

  it("5 OT days x Rs.758 = 3790 -> already a multiple of 10", () => {
    expect(computeOvertimeAmount(5, 758)).toBe(3790);
  });

  it("0 OT days -> 0 amount", () => {
    expect(computeOvertimeAmount(0, 2554)).toBe(0);
  });
});

describe("RTT calculation", () => {
  it("applies flat configured amount when applicable and enabled", () => {
    expect(computeRtt({ enabled: true, amount: 100 }, true)).toBe(100);
  });

  it("0 when not applicable", () => {
    expect(computeRtt({ enabled: true, amount: 100 }, false)).toBe(0);
  });
});

describe("calculateEmployeePayroll — end to end (spec sample payroll flow, section 70)", () => {
  const pfRule = { enabled: true, ratePercent: 12, wageCeiling: null };
  const esiRule = { enabled: true, ratePercent: 0.75, wageCeiling: 21000 };
  const ptSlabs = [
    { minSalary: 0, maxSalary: 15000, ptAmount: 0 },
    { minSalary: 15001, maxSalary: 20000, ptAmount: 150 },
    { minSalary: 20001, maxSalary: null, ptAmount: 200 },
  ];
  const rttRule = { enabled: true, amount: 0 };
  const bonusRule = { enabled: true, amount: 200 };

  it("Prakash: full attendance, gets bonus, PF+PT applicable", () => {
    const r = calculateEmployeePayroll({
      basicSalary: 20000,
      monthlySalary: 20000,
      workingDays: 25,
      presentDays: 25,
      actualAbsentDays: 0,
      advanceAmount: 0,
      paidLeaveApplicable: true,
      canteenCharges: 0,
      otDays: 0,
      pfApplicable: true,
      esiApplicable: false,
      ptApplicable: true,
      rttApplicable: false,
      bonusRule,
      pfRule,
      esiRule,
      ptSlabs,
      rttRule,
    });
    expect(r.salaryAfterAbsence).toBe(20000);
    expect(r.bonusEligible).toBe(true);
    expect(r.bonus).toBe(200);
    expect(r.totalEarnings).toBe(20200);
    expect(r.pf).toBe(2400);
    expect(r.pt).toBe(150); // 20000 salary base falls in the 15001-20000 slab
    expect(r.netSalary).toBe(20200 - 2400 - 150);
  });

  it("Ravi: 1 absence covered by paid leave, no deduction, no bonus", () => {
    const r = calculateEmployeePayroll({
      basicSalary: 18000,
      monthlySalary: 18000,
      workingDays: 25,
      presentDays: 24,
      actualAbsentDays: 1,
      advanceAmount: 0,
      paidLeaveApplicable: true,
      canteenCharges: 0,
      otDays: 0,
      pfApplicable: false,
      esiApplicable: false,
      ptApplicable: true,
      rttApplicable: false,
      bonusRule,
      pfRule,
      esiRule,
      ptSlabs,
      rttRule,
    });
    expect(r.deductibleAbsentDays).toBe(0);
    expect(r.salaryAfterAbsence).toBe(18000);
    expect(r.bonusEligible).toBe(false);
    expect(r.bonus).toBe(0);
  });

  it("Suresh: 3 actual absences, 1 covered, 2 deductible", () => {
    const r = calculateEmployeePayroll({
      basicSalary: 20000,
      monthlySalary: 20000,
      workingDays: 25,
      presentDays: 22,
      actualAbsentDays: 3,
      advanceAmount: 0,
      paidLeaveApplicable: true,
      canteenCharges: 0,
      otDays: 0,
      pfApplicable: false,
      esiApplicable: false,
      ptApplicable: false,
      rttApplicable: false,
      bonusRule,
      pfRule,
      esiRule,
      ptSlabs,
      rttRule,
    });
    expect(r.deductibleAbsentDays).toBe(2);
    expect(r.absenceDeduction).toBe(1600); // 20000/25 * 2
    expect(r.salaryAfterAbsence).toBe(18400);
  });

  it("advance reduces net salary directly", () => {
    const r = calculateEmployeePayroll({
      basicSalary: 20000,
      monthlySalary: 20000,
      workingDays: 25,
      presentDays: 25,
      actualAbsentDays: 0,
      advanceAmount: 1000,
      paidLeaveApplicable: true,
      canteenCharges: 0,
      otDays: 0,
      pfApplicable: false,
      esiApplicable: false,
      ptApplicable: false,
      rttApplicable: false,
      bonusRule: null,
      pfRule: null,
      esiRule: null,
      ptSlabs: [],
      rttRule: null,
    });
    expect(r.advance).toBe(1000);
    expect(r.netSalary).toBe(20000 - 1000);
  });

  it("rejects negative advance", () => {
    expect(() =>
      calculateEmployeePayroll({
        basicSalary: 20000,
        monthlySalary: 20000,
        workingDays: 25,
        presentDays: 25,
        actualAbsentDays: 0,
        advanceAmount: -1,
        paidLeaveApplicable: true,
        canteenCharges: 0,
        otDays: 0,
        pfApplicable: false,
        esiApplicable: false,
        ptApplicable: false,
        rttApplicable: false,
        bonusRule: null,
        pfRule: null,
        esiRule: null,
        ptSlabs: [],
        rttRule: null,
      })
    ).toThrow(PayrollValidationError);
  });
});
