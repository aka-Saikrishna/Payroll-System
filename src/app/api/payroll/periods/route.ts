import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, handleApiError } from "@/lib/api-helpers";
import { computeCalendarBreakdown } from "@/lib/payroll/period";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export async function GET() {
  try {
    await requireSession();
    const periods = await prisma.payrollPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { _count: { select: { payrollRecords: true } } },
    });
    return NextResponse.json({ periods });
  } catch (error) {
    return handleApiError(error);
  }
}

const createPeriodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = createPeriodSchema.parse(await request.json());

    const existing = await prisma.payrollPeriod.findUnique({
      where: { year_month: { year: body.year, month: body.month } },
    });
    if (existing) return NextResponse.json({ period: existing });

    const breakdown = await computeCalendarBreakdown(body.year, body.month);
    const period = await prisma.payrollPeriod.create({
      data: {
        year: body.year,
        month: body.month,
        workingDays: breakdown.workingDays,
        weeklyOffDays: breakdown.weeklyOffDays,
        holidayDays: breakdown.holidayDays,
        calendarDays: breakdown.calendarDays,
        status: "DRAFT",
      },
    });

    await writeAuditLog({
      userId: session.sub,
      action: "PAYROLL_PERIOD_CREATED",
      entity: "PayrollPeriod",
      entityId: period.id,
      newValue: { ...breakdown },
    });

    return NextResponse.json({ period }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
