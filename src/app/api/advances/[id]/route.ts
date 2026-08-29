import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { advanceSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = advanceSchema.parse(await request.json());
    const before = await prisma.salaryAdvance.findUnique({ where: { id: params.id } });
    if (!before) throw new ApiError(404, "Advance not found");

    const advance = await prisma.salaryAdvance.update({
      where: { id: params.id },
      data: {
        employeeId: body.employeeId,
        advanceDate: new Date(body.advanceDate),
        amount: body.amount,
        reference: body.reference || null,
        remarks: body.remarks || null,
        payrollPeriodId: body.payrollPeriodId || null,
      },
      include: { employee: { select: { id: true, employeeCode: true, name: true } } },
    });

    await writeAuditLog({
      userId: session.sub,
      action: "ADVANCE_UPDATED",
      entity: "SalaryAdvance",
      entityId: advance.id,
      oldValue: JSON.parse(JSON.stringify(before)),
      newValue: body,
    });

    return NextResponse.json({ advance });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const advance = await prisma.salaryAdvance.findUnique({ where: { id: params.id } });
    if (!advance) throw new ApiError(404, "Advance not found");

    await prisma.salaryAdvance.delete({ where: { id: params.id } });

    await writeAuditLog({
      userId: session.sub,
      action: "ADVANCE_DELETED",
      entity: "SalaryAdvance",
      entityId: params.id,
      oldValue: JSON.parse(JSON.stringify(advance)),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
