import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";
import { recalculateSingleEmployeePayroll } from "@/lib/payroll/payrollService";

/**
 * The payroll-configuration flags that can be set across many employees at
 * once. Restricted to this list so a client cannot name an arbitrary column.
 */
const BULK_CONFIG_FIELDS = [
  "pfApplicable",
  "esiApplicable",
  "ptApplicable",
  "bonusApplicable",
  "paidLeaveApplicable",
] as const;

const bulkSchema = z.object({
  field: z.enum(BULK_CONFIG_FIELDS),
  /** Employees that should end up with the flag ON. Everyone else in scope
   *  is turned OFF, so the submitted set is the complete picture for the
   *  field rather than a list of additions. */
  enabledIds: z.array(z.string()).default([]),
  /** The employees the editor was actually looking at. Anyone outside this
   *  set is left untouched, so a filtered or searched list cannot silently
   *  clear the flag for employees who were never on screen. */
  scopeIds: z.array(z.string()).min(1, "No employees in scope"),
  company: z.string().default("VPPL"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = bulkSchema.parse(await request.json());

    const scope = new Set(body.scopeIds);
    const wantEnabled = new Set(body.enabledIds.filter((id) => scope.has(id)));

    // Only touch employees of the requested company — guards against ids from
    // another company being passed in.
    const owned = await prisma.employee.findMany({
      where: { id: { in: body.scopeIds }, company: body.company },
      select: { id: true },
    });
    if (owned.length === 0) throw new ApiError(400, "No matching employees for this company");

    const toEnable = owned.filter((e) => wantEnabled.has(e.id)).map((e) => e.id);
    const toDisable = owned.filter((e) => !wantEnabled.has(e.id)).map((e) => e.id);

    const [on, off] = await prisma.$transaction([
      prisma.employeeSalaryConfig.updateMany({
        where: { employeeId: { in: toEnable } },
        data: { [body.field]: true },
      }),
      prisma.employeeSalaryConfig.updateMany({
        where: { employeeId: { in: toDisable } },
        data: { [body.field]: false },
      }),
    ]);

    // Employee flags such as bonus applicability can be changed after payroll
    // was generated. Recalculate affected rows in every open period so those
    // saved choices immediately flow through to salary sheets for this company.
    const affectedIds = owned.map((employee) => employee.id);
    const openPayrollRecords = await prisma.payrollRecord.findMany({
      where: {
        employeeId: { in: affectedIds },
        payrollPeriod: { is: { status: { not: "FINALIZED" } } },
      },
      select: { employeeId: true, payrollPeriodId: true },
    });
    await Promise.all(
      openPayrollRecords.map((record) =>
        recalculateSingleEmployeePayroll(record.payrollPeriodId, record.employeeId, session.sub)
      )
    );

    writeAuditLog({
      userId: session.sub,
      action: "EMPLOYEE_BULK_CONFIG_UPDATED",
      entity: "EmployeeSalaryConfig",
      entityId: body.field,
      newValue: { field: body.field, company: body.company, enabled: on.count, disabled: off.count },
    });

    return NextResponse.json({
      field: body.field,
      enabled: on.count,
      disabled: off.count,
      payrollRecordsUpdated: openPayrollRecords.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
