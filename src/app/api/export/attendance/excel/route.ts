import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { getOrCreatePayrollPeriod } from "@/lib/payroll/period";
import { buildAttendanceWorkbook, AttendanceExportRow } from "@/lib/excel/attendanceExport";
import { getCompanyByCode } from "@/lib/companies";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const company = searchParams.get("company")?.trim() || "VPPL";

    const period = await getOrCreatePayrollPeriod(year, month);

    const employees = await prisma.employee.findMany({
      where: { status: "ACTIVE", company },
      orderBy: { employeeCode: "asc" },
      select: { id: true, employeeCode: true, name: true },
    });

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));

    const allAttendance = await prisma.attendance.findMany({
      where: {
        attendanceDate: { gte: monthStart, lte: monthEnd },
        employeeId: { in: employees.map((e) => e.id) },
      },
      select: { employeeId: true, status: true },
    });

    const counts = new Map<string, { present: number; absent: number }>();
    for (const rec of allAttendance) {
      const entry = counts.get(rec.employeeId) ?? { present: 0, absent: 0 };
      if (rec.status === "PRESENT") entry.present++;
      else if (rec.status === "ABSENT") entry.absent++;
      counts.set(rec.employeeId, entry);
    }

    const rows: AttendanceExportRow[] = employees.map((e, idx) => {
      const c = counts.get(e.id) ?? { present: 0, absent: 0 };
      return {
        slNo: idx + 1,
        employeeCode: e.employeeCode,
        name: e.name,
        workingDays: period.workingDays,
        presentDays: c.present,
        absentDays: c.absent,
      };
    });

    const buffer = await buildAttendanceWorkbook(
      { companyName: getCompanyByCode(company).name, year, month },
      rows
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="attendance_${company}_${year}_${month}.xlsx"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
