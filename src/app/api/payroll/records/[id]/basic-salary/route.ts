import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { recalculateSingleEmployeePayroll } from "@/lib/payroll/payrollService";
import { z } from "zod";

const schema = z.object({
  basicSalary: z.coerce.number().min(0, "Basic salary cannot be negative"),
  hra: z.coerce.number().min(0, "HRA cannot be negative"),
  conveyance: z.coerce.number().min(0, "Conveyance cannot be negative"),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = schema.parse(await request.json());

    const existing = await prisma.payrollRecord.findUnique({
      where: { id: params.id },
      include: { payrollPeriod: true },
    });
    if (!existing) throw new ApiError(404, "Payroll record not found");
    if (existing.payrollPeriod.status === "FINALIZED") {
      throw new ApiError(409, "Payroll is finalized. Reopen the period before editing.");
    }

    await prisma.employeeSalaryConfig.update({
      where: { employeeId: existing.employeeId },
      data: {
        basicSalary: body.basicSalary,
        hra: body.hra,
        conveyance: body.conveyance,
        monthlySalary: body.basicSalary + body.hra + body.conveyance,
      },
    });

    const record = await recalculateSingleEmployeePayroll(existing.payrollPeriodId, existing.employeeId, session.sub);
    return NextResponse.json({ record });
  } catch (error) {
    return handleApiError(error);
  }
}
