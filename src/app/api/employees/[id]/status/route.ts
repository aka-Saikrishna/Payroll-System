import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const statusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = statusSchema.parse(await request.json());

    const before = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!before) throw new ApiError(404, "Employee not found");

    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: { status: body.status },
      include: { salaryConfig: true },
    });

    // Drop the employee off any salary sheet that has not been paid out yet.
    // Finalized periods are left alone so paid history stays intact.
    let removedFromPeriods = 0;
    if (body.status === "INACTIVE") {
      const { count } = await prisma.payrollRecord.deleteMany({
        where: {
          employeeId: params.id,
          payrollPeriod: { status: { not: "FINALIZED" } },
        },
      });
      removedFromPeriods = count;
    }

    await writeAuditLog({
      userId: session.sub,
      action: body.status === "INACTIVE" ? "EMPLOYEE_DEACTIVATED" : "EMPLOYEE_ACTIVATED",
      entity: "Employee",
      entityId: employee.id,
      oldValue: { status: before.status },
      newValue: { status: employee.status, removedFromPeriods },
    });

    return NextResponse.json({ employee });
  } catch (error) {
    return handleApiError(error);
  }
}
