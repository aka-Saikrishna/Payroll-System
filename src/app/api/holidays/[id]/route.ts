import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { holidaySchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = holidaySchema.parse(await request.json());
    const before = await prisma.holiday.findUnique({ where: { id: params.id } });
    if (!before) throw new ApiError(404, "Holiday not found");

    const holiday = await prisma.holiday.update({
      where: { id: params.id },
      data: { date: new Date(body.date), name: body.name, type: body.type, status: body.status },
    });

    await writeAuditLog({
      userId: session.sub,
      action: "HOLIDAY_UPDATED",
      entity: "Holiday",
      entityId: holiday.id,
      oldValue: JSON.parse(JSON.stringify(before)),
      newValue: body,
    });

    return NextResponse.json({ holiday });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const holiday = await prisma.holiday.findUnique({ where: { id: params.id } });
    if (!holiday) throw new ApiError(404, "Holiday not found");

    await prisma.holiday.delete({ where: { id: params.id } });

    await writeAuditLog({ userId: session.sub, action: "HOLIDAY_DELETED", entity: "Holiday", entityId: params.id, oldValue: JSON.parse(JSON.stringify(holiday)) });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
