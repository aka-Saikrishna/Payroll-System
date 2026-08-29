import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { userSchema } from "@/lib/validation/misc";
import { hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = userSchema.parse(await request.json());
    const before = await prisma.user.findUnique({ where: { id: params.id } });
    if (!before) throw new ApiError(404, "User not found");

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        role: body.role,
        status: body.status,
        ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    await writeAuditLog({
      userId: session.sub,
      action: "USER_UPDATED",
      entity: "User",
      entityId: user.id,
      oldValue: { name: before.name, email: before.email, role: before.role, status: before.status },
      newValue: { ...body, password: undefined },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    if (params.id === session.sub) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }
    const user = await prisma.user.update({ where: { id: params.id }, data: { status: "INACTIVE" } });

    await writeAuditLog({ userId: session.sub, action: "USER_DEACTIVATED", entity: "User", entityId: user.id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
