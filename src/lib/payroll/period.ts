import { prisma } from "@/lib/prisma";

export interface CalendarBreakdown {
  calendarDays: number;
  weeklyOffDays: number;
  holidayDays: number;
  workingDays: number;
}

/**
 * Computes the company calendar for a given year/month. Working Days is
 * the total number of calendar days in the month — weekly offs and
 * holidays are tracked separately for reference/reporting but are no
 * longer subtracted from Working Days.
 */
export async function computeCalendarBreakdown(year: number, month: number): Promise<CalendarBreakdown> {
  const calendarDays = new Date(year, month, 0).getDate(); // month is 1-12; day 0 of next month = last day of this month

  const settings = await prisma.companySettings.findFirst();
  const weeklyOffWeekdays = new Set(settings?.weeklyOffDays ?? [0]);

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month - 1, calendarDays));

  const holidays = await prisma.holiday.findMany({
    where: {
      status: "ACTIVE",
      date: { gte: monthStart, lte: monthEnd },
    },
  });
  const holidayDateStrings = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
  const holidayDays = holidayDateStrings.size;

  let weeklyOffDays = 0;
  for (let d = 1; d <= calendarDays; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const iso = date.toISOString().slice(0, 10);
    if (holidayDateStrings.has(iso)) continue; // already counted as a holiday
    if (weeklyOffWeekdays.has(date.getUTCDay())) weeklyOffDays++;
  }

  return { calendarDays, weeklyOffDays, holidayDays, workingDays: calendarDays };
}

export async function getOrCreatePayrollPeriod(year: number, month: number) {
  const existing = await prisma.payrollPeriod.findUnique({ where: { year_month: { year, month } } });
  if (existing) return existing;

  const breakdown = await computeCalendarBreakdown(year, month);
  return prisma.payrollPeriod.create({
    data: {
      year,
      month,
      workingDays: breakdown.workingDays,
      weeklyOffDays: breakdown.weeklyOffDays,
      holidayDays: breakdown.holidayDays,
      calendarDays: breakdown.calendarDays,
      status: "DRAFT",
    },
  });
}
