import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-helpers";
import { buildRegisterOfWagesWorkbook, RegisterRow } from "@/lib/excel/registerExport";
import { formatDate } from "@/lib/date-utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const periodId = request.nextUrl.searchParams.get("periodId");
    if (!periodId) throw new ApiError(400, "periodId is required");

    const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new ApiError(404, "Payroll period not found");

    const employeeIdsParam = request.nextUrl.searchParams.get("employeeIds")?.trim();
    const employeeIds = employeeIdsParam ? employeeIdsParam.split(",").filter(Boolean) : null;

    const [records, settings] = await Promise.all([
      prisma.payrollRecord.findMany({
        where: { payrollPeriodId: periodId, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
        include: { employee: true },
        orderBy: { employee: { name: "asc" } },
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
      daysWorked: r.presentDays,
      daysAbsent: r.actualAbsentDays,
      totalGrossSalary: Number(r.salaryAfterAbsence),
      pf: Number(r.pf),
      esi: Number(r.esi),
      pt: Number(r.pt),
      advance: Number(r.advance),
      canteenCharges: Number(r.canteenCharges),
      totalDeductions: Number(r.totalDeductions),
      otAmount: Number(r.otAmount),
      netSalaryPaid: Number(r.netSalary),
      dateOfPayment: r.status === "FINALIZED" ? formatDate(r.updatedAt) : "",
    }));

    const buffer = await buildRegisterOfWagesWorkbook(
      {
        companyName: settings?.companyName || "VEEKAY",
        address: settings?.address || "",
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
