import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { recalculateSingleEmployeePayroll } from "@/lib/payroll/payrollService";
import { z } from "zod";

const schema = z.object({
  amount: z.coerce.number().min(0, "Advance cannot be negative"),
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

    // A single deterministic advance row represents this period's Salary
    // Sheet entry, kept separate from ad-hoc advances issued via the
    // Advances page (which have their own auto-generated ids).
    const sheetAdvanceId = `sheet-advance-${existing.employeeId}-${existing.payrollPeriodId}`;
    await prisma.salaryAdvance.upsert({
      where: { id: sheetAdvanceId },
      update: { amount: body.amount },
      create: {
        id: sheetAdvanceId,
        employeeId: existing.employeeId,
        payrollPeriodId: existing.payrollPeriodId,
        advanceDate: new Date(Date.UTC(existing.payrollPeriod.year, existing.payrollPeriod.month - 1, 1)),
        amount: body.amount,
        reference: "Salary Sheet Entry",
      },
    });

    const record = await recalculateSingleEmployeePayroll(existing.payrollPeriodId, existing.employeeId, session.sub);
    return NextResponse.json({ record });
  } catch (error) {
    return handleApiError(error);
  }
}
