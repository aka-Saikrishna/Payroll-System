import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { attendanceSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = attendanceSchema.parse(await request.json());
    const attendanceDate = new Date(body.attendanceDate);

    const record = await prisma.attendance.upsert({
      where: { employeeId_attendanceDate: { employeeId: body.employeeId, attendanceDate } },
      create: {
        employeeId: body.employeeId,
        attendanceDate,
        status: body.status,
        remarks: body.remarks || null,
      },
      update: {
        status: body.status,
        remarks: body.remarks || null,
      },
    });

    await writeAuditLog({
      userId: session.sub,
      action: "ATTENDANCE_UPDATED",
      entity: "Attendance",
      entityId: record.id,
      newValue: body,
    });

    return NextResponse.json({ record });
  } catch (error) {
    return handleApiError(error);
  }
}
