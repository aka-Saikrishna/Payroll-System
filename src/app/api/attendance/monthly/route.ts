import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { attendanceMonthlySchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";
import { recalculateSingleEmployeePayroll } from "@/lib/payroll/payrollService";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = attendanceMonthlySchema.parse(await request.json());
    const daysInMonth = new Date(body.year, body.month, 0).getDate();

    if (body.absentDays > daysInMonth) {
      throw new ApiError(400, `Absent days cannot exceed ${daysInMonth} days in this month`);
    }

    const monthStart = new Date(Date.UTC(body.year, body.month - 1, 1));
    const monthEnd = new Date(Date.UTC(body.year, body.month, 0));

    const rows = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return {
        employeeId: body.employeeId,
        attendanceDate: new Date(Date.UTC(body.year, body.month - 1, day)),
        status: day <= body.absentDays ? ("ABSENT" as const) : ("PRESENT" as const),
      };
    });

    await prisma.$transaction([
      prisma.attendance.deleteMany({
        where: { employeeId: body.employeeId, attendanceDate: { gte: monthStart, lte: monthEnd } },
      }),
      prisma.attendance.createMany({ data: rows }),
    ]);

    // If payroll already exists for this month, immediately refresh this
    // employee's attendance-derived figures and bonus. A finalized payroll
    // remains an immutable snapshot.
    const period = await prisma.payrollPeriod.findUnique({
      where: { year_month: { year: body.year, month: body.month } },
      select: { id: true, status: true },
    });
    let payrollUpdated = false;
    if (period && period.status !== "FINALIZED") {
      const existingRecord = await prisma.payrollRecord.findUnique({
        where: { payrollPeriodId_employeeId: { payrollPeriodId: period.id, employeeId: body.employeeId } },
        select: { id: true },
      });
      if (existingRecord) {
        await recalculateSingleEmployeePayroll(period.id, body.employeeId, session.sub);
        payrollUpdated = true;
      }
    }

    await writeAuditLog({
      userId: session.sub,
      action: "ATTENDANCE_UPDATED",
      entity: "Attendance",
      entityId: body.employeeId,
      newValue: { year: body.year, month: body.month, absentDays: body.absentDays, presentDays: daysInMonth - body.absentDays },
    });

    return NextResponse.json({
      presentDays: daysInMonth - body.absentDays,
      absentDays: body.absentDays,
      payrollUpdated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
