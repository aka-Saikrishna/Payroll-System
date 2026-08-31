import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { getOrCreatePayrollPeriod } from "@/lib/payroll/period";
import { computeAttendanceDerivedFields } from "@/lib/payroll/engine";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const search = searchParams.get("search")?.trim();
    const department = searchParams.get("department")?.trim();

    const period = await getOrCreatePayrollPeriod(year, month);

    const company = searchParams.get("company")?.trim() || "VPPL";

    const where: Prisma.EmployeeWhereInput = {
      status: "ACTIVE",
      company,
      ...(department ? { department } : {}),
      ...(search
        ? {
            OR: [
              { employeeCode: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { employeeCode: "asc" },
      include: { salaryConfig: { select: { paidLeaveApplicable: true } } },
    });

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));

    const allAttendance = await prisma.attendance.findMany({
      where: { attendanceDate: { gte: monthStart, lte: monthEnd }, employeeId: { in: employees.map((e) => e.id) } },
      select: { employeeId: true, status: true },
    });

    const attendanceByEmployee = new Map<string, { present: number; absent: number }>();
    for (const rec of allAttendance) {
      const entry = attendanceByEmployee.get(rec.employeeId) ?? { present: 0, absent: 0 };
      if (rec.status === "PRESENT") entry.present++;
      else if (rec.status === "ABSENT") entry.absent++;
      attendanceByEmployee.set(rec.employeeId, entry);
    }

    const rows = employees.map((employee) => {
      const counts = attendanceByEmployee.get(employee.id) ?? { present: 0, absent: 0 };
      const derived = computeAttendanceDerivedFields({
        workingDays: period.workingDays,
        presentDays: counts.present,
        actualAbsentDays: counts.absent,
        paidLeaveApplicable: employee.salaryConfig?.paidLeaveApplicable ?? false,
      });
      return {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        department: employee.department,
        workingDays: period.workingDays,
        presentDays: counts.present,
        actualAbsentDays: counts.absent,
        paidLeaveApplicable: employee.salaryConfig?.paidLeaveApplicable ?? false,
        ...derived,
      };
    });

    return NextResponse.json({ period, rows });
  } catch (error) {
    return handleApiError(error);
  }
}
