import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, handleApiError } from "@/lib/api-helpers";
import { holidaySchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const search = request.nextUrl.searchParams.get("search")?.trim();
    const where: Prisma.HolidayWhereInput = search ? { name: { contains: search, mode: "insensitive" } } : {};
    const holidays = await prisma.holiday.findMany({ where, orderBy: { date: "asc" } });
    return NextResponse.json({ holidays });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = holidaySchema.parse(await request.json());
    const date = new Date(body.date);

    const existing = await prisma.holiday.findUnique({ where: { date } });
    if (existing) return NextResponse.json({ error: "A holiday already exists on this date" }, { status: 409 });

    const holiday = await prisma.holiday.create({
      data: { date, name: body.name, type: body.type, status: body.status },
    });

    await writeAuditLog({ userId: session.sub, action: "HOLIDAY_CREATED", entity: "Holiday", entityId: holiday.id, newValue: body });

    return NextResponse.json({ holiday }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
