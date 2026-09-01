import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, handleApiError, ApiError } from "@/lib/api-helpers";
import { employeeSchema } from "@/lib/validation/employee";
import { writeAuditLog } from "@/lib/audit";
import { recalculateSingleEmployeePayroll, reopenPayrollPeriod, finalizePayrollPeriod } from "@/lib/payroll/payrollService";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      include: { salaryConfig: true },
    });
    if (!employee) throw new ApiError(404, "Employee not found");
    return NextResponse.json({ employee });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = employeeSchema.parse(await request.json());

    const before = await prisma.employee.findUnique({ where: { id: params.id }, include: { salaryConfig: true } });
    if (!before) throw new ApiError(404, "Employee not found");

    // Employee ID is no longer editable from the form; it's preserved as-is
    // unless a direct API caller explicitly supplies a new one.
    const employeeCode = body.employeeCode || before.employeeCode;
    if (employeeCode !== before.employeeCode) {
      const codeClash = await prisma.employee.findFirst({
        where: { employeeCode, NOT: { id: params.id } },
      });
      if (codeClash) {
        return NextResponse.json({ error: "Another employee already uses this Employee ID" }, { status: 409 });
      }
    }

    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: {
        employeeCode,
        name: body.name,
        mobile: body.mobile || null,
        email: body.email || null,
        address: body.address || null,
        department: body.department || null,
        designation: body.designation || null,
        joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
        status: body.status,
        salaryConfig: {
          upsert: {
            create: {
              basicSalary: body.basicSalary,
              hra: body.hra,
              conveyance: body.conveyance,
              monthlySalary: body.basicSalary + body.hra + body.conveyance,
              pfApplicable: body.pfApplicable,
              esiApplicable: body.esiApplicable,
              ptApplicable: body.ptApplicable,
              paidLeaveApplicable: body.paidLeaveApplicable,
            },
            update: {
              basicSalary: body.basicSalary,
              hra: body.hra,
              conveyance: body.conveyance,
              monthlySalary: body.basicSalary + body.hra + body.conveyance,
              pfApplicable: body.pfApplicable,
              esiApplicable: body.esiApplicable,
              ptApplicable: body.ptApplicable,
              paidLeaveApplicable: body.paidLeaveApplicable,
            },
          },
        },
      },
      include: { salaryConfig: true },
    });

    await writeAuditLog({
      userId: session.sub,
      action: "EMPLOYEE_UPDATED",
      entity: "Employee",
      entityId: employee.id,
      oldValue: JSON.parse(JSON.stringify(before)),
      newValue: body,
    });

    const allRecords = await prisma.payrollRecord.findMany({
      where: { employeeId: employee.id },
      select: { payrollPeriodId: true, payrollPeriod: { select: { status: true } } },
    });
    for (const rec of allRecords) {
      const wasFinalized = rec.payrollPeriod.status === "FINALIZED";
      if (wasFinalized) {
        await reopenPayrollPeriod(rec.payrollPeriodId, session.sub, "Auto-reopen: salary config updated");
      }
      await recalculateSingleEmployeePayroll(rec.payrollPeriodId, employee.id, session.sub);
      if (wasFinalized) {
        await finalizePayrollPeriod(rec.payrollPeriodId, session.sub);
      }
    }

    return NextResponse.json({ employee });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    const employee = await prisma.employee.findUnique({ where: { id: params.id } });
    if (!employee) throw new ApiError(404, "Employee not found");

    const payrollCount = await prisma.payrollRecord.count({ where: { employeeId: params.id } });
    if (payrollCount > 0) {
      return NextResponse.json(
        { error: "This employee has payroll history and cannot be deleted. Set status to Inactive instead." },
        { status: 409 }
      );
    }

    await prisma.employee.delete({ where: { id: params.id } });

    await writeAuditLog({
      userId: session.sub,
      action: "EMPLOYEE_DELETED",
      entity: "Employee",
      entityId: params.id,
      oldValue: JSON.parse(JSON.stringify(employee)),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
