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

    const where: Prisma.EmployeeWhereInput = {
      status: "ACTIVE",
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

    const rows = await Promise.all(
      employees.map(async (employee) => {
        const records = await prisma.attendance.findMany({
          where: { employeeId: employee.id, attendanceDate: { gte: monthStart, lte: monthEnd } },
        });
        const presentDays = records.filter((r) => r.status === "PRESENT").length;
        const actualAbsentDays = records.filter((r) => r.status === "ABSENT").length;

        const derived = computeAttendanceDerivedFields({
          workingDays: period.workingDays,
          presentDays,
          actualAbsentDays,
          paidLeaveApplicable: employee.salaryConfig?.paidLeaveApplicable ?? false,
        });

        return {
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          name: employee.name,
          department: employee.department,
          workingDays: period.workingDays,
          presentDays,
          actualAbsentDays,
          ...derived,
        };
      })
    );

    return NextResponse.json({ period, rows });
  } catch (error) {
    return handleApiError(error);
  }
}
