import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { attendanceMonthlySchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

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

    await writeAuditLog({
      userId: session.sub,
      action: "ATTENDANCE_UPDATED",
      entity: "Attendance",
      entityId: body.employeeId,
      newValue: { year: body.year, month: body.month, absentDays: body.absentDays, presentDays: daysInMonth - body.absentDays },
    });

    return NextResponse.json({ presentDays: daysInMonth - body.absentDays, absentDays: body.absentDays });
  } catch (error) {
    return handleApiError(error);
  }
}
