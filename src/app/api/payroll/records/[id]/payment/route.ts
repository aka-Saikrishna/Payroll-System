import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const paymentSchema = z.object({
  chequeAmount: z.coerce.number().min(0, "Cheque amount cannot be negative"),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = paymentSchema.parse(await request.json());

    const record = await prisma.payrollRecord.findUnique({
      where: { id: params.id },
      include: { payrollPeriod: true },
    });
    if (!record) throw new ApiError(404, "Payroll record not found");
    if (record.payrollPeriod.status === "FINALIZED") {
      throw new ApiError(409, "Payroll is finalized. Reopen the period before editing the payment split.");
    }

    const netSalary = Number(record.netSalary);
    if (body.chequeAmount > netSalary) {
      throw new ApiError(400, "Cheque amount cannot exceed Net Salary");
    }

    const cashAmount = Math.round((netSalary - body.chequeAmount + Number.EPSILON) * 100) / 100;
    const chequeAmount = Math.round((body.chequeAmount + Number.EPSILON) * 100) / 100;

    const updated = await prisma.payrollRecord.update({
      where: { id: params.id },
      data: { cashAmount, chequeAmount },
    });

    writeAuditLog({
      userId: session.sub,
      action: "PAYROLL_PAYMENT_SPLIT_UPDATED",
      entity: "PayrollRecord",
      entityId: record.id,
      oldValue: { cashAmount: record.cashAmount, chequeAmount: record.chequeAmount },
      newValue: { cashAmount, chequeAmount },
    });

    return NextResponse.json({ record: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
