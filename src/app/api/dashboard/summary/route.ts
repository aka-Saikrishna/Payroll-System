import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { z } from "zod";

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const { year, month } = querySchema.parse({
      year: request.nextUrl.searchParams.get("year"),
      month: request.nextUrl.searchParams.get("month"),
    });

    const [employeeCount, period] = await Promise.all([
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.payrollPeriod.findUnique({ where: { year_month: { year, month } } }),
    ]);

    let totals = { totalSalary: 0, totalDeductions: 0, totalNetPayable: 0, recordCount: 0 };
    if (period) {
      const agg = await prisma.payrollRecord.aggregate({
        where: { payrollPeriodId: period.id },
        _sum: { salaryAfterAbsence: true, totalDeductions: true, netSalary: true },
        _count: true,
      });
      totals = {
        totalSalary: Number(agg._sum.salaryAfterAbsence ?? 0),
        totalDeductions: Number(agg._sum.totalDeductions ?? 0),
        totalNetPayable: Number(agg._sum.netSalary ?? 0),
        recordCount: agg._count,
      };
    }

    return NextResponse.json({ employeeCount, period, totals });
  } catch (error) {
    return handleApiError(error);
  }
}
