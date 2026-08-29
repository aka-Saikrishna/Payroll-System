import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-helpers";
import { recalculateSingleEmployeePayroll } from "@/lib/payroll/payrollService";
import { requireRole } from "@/lib/api-helpers";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const record = await prisma.payrollRecord.findUnique({
      where: { id: params.id },
      include: {
        employee: true,
        payrollPeriod: true,
      },
    });
    if (!record) throw new ApiError(404, "Payroll record not found");
    return NextResponse.json({ record });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const existing = await prisma.payrollRecord.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError(404, "Payroll record not found");

    const record = await recalculateSingleEmployeePayroll(existing.payrollPeriodId, existing.employeeId, session.sub);
    return NextResponse.json({ record });
  } catch (error) {
    return handleApiError(error);
  }
}
