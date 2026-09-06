import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-helpers";
import { buildRegisterOfWagesWorkbook, RegisterRow } from "@/lib/excel/registerExport";
import { getCompanyByCode } from "@/lib/companies";
import { computeProratedOtherAmount } from "@/lib/payroll/engine";
import { formatDate } from "@/lib/date-utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const periodId = request.nextUrl.searchParams.get("periodId");
    if (!periodId) throw new ApiError(400, "periodId is required");

    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new ApiError(404, "Payroll period not found");

    const company = request.nextUrl.searchParams.get("company") || "VPPL";
    const employeeIdsParam = request.nextUrl.searchParams.get("employeeIds")?.trim();
    const employeeIds = employeeIdsParam ? employeeIdsParam.split(",").filter(Boolean) : null;

    const [records, settings] = await Promise.all([
      prisma.payrollRecord.findMany({
        where: {
          payrollPeriodId: periodId,
          // Matches the salary sheet: a finalized period keeps deactivated
          // employees (that is what was paid), an open one shows only active.
          employee: { company, ...(period.status === "FINALIZED" ? {} : { status: "ACTIVE" }) },
          ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
        },
        include: { employee: true },
        orderBy: { employee: { employeeCode: "asc" } },
      }),
      prisma.companySettings.findFirst(),
    ]);

    const rows: RegisterRow[] = records.map((r, idx) => ({
      slNo: idx + 1,
      employeeCode: r.employee.employeeCode,
      name: r.employee.name,
      basicSalary: Number(r.basicSalary),
      hra: Number(r.hra),
      conveyance: Number(r.conveyance),
      totalPay: Number(r.monthlySalary),
      // Paid-leave adjusted, so the register reconciles with what was paid:
      // gross salary is derived from payableDays, and these two always sum to
      // workingDays. Raw presentDays / actualAbsentDays would show an absence
      // that the paid leave already covered and was never deducted for.
      daysWorked: r.payableDays,
      daysAbsent: r.deductibleAbsentDays,
      totalGrossSalary: Number(r.salaryAfterAbsence),
      pf: Number(r.pf),
      esi: Number(r.esi),
      pt: Number(r.pt),
      advance: Number(r.advance),
      canteenCharges: Number(r.canteenCharges),
      totalDeductions: Number(r.totalDeductions),
      otAmount: Number(r.otAmount),
      // The stored figure is the raw monthly Other Salary; what was actually
      // paid is that pro-rated by attendance. Reporting the raw value here
      // would leave the register short of its own Net Salary column.
      otherAmount: computeProratedOtherAmount(Number(r.otherAmount), r.workingDays, r.payableDays),
      bonus: Number(r.bonus),
      netSalaryPaid: Number(r.netSalary),
      dateOfPayment: r.status === "FINALIZED" ? formatDate(r.updatedAt) : "",
    }));

    const buffer = await buildRegisterOfWagesWorkbook(
      {
        // Must come from the selected company, not companySettings — that is a
        // single global row, so a VPFL export was printing VPPL's name.
        companyName: getCompanyByCode(company).name,
        // Per-company premises. Deliberately not falling back to the
        // CompanySettings address — that is one address for two sites, so a
        // fallback would print the other company's premises.
        address: getCompanyByCode(company).address,
        managerName: settings?.managerName || "",
        statutoryRef: settings?.statutoryRef || "Vide rule 6 A of A.P. PAYMENT OF Wages Rules, 1937",
        year: period.year,
        month: period.month,
      },
      rows
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="payment_register_${period.year}_${period.month}.xlsx"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
