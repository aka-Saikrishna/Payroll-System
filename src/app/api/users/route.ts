import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { userSchema } from "@/lib/validation/misc";
import { hashPassword } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    await requireRole(["ADMIN"]);
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = userSchema.parse(await request.json());
    if (!body.password) {
      return NextResponse.json({ error: "Password is required for new users" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash: await hashPassword(body.password),
        role: body.role,
        status: body.status,
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    await writeAuditLog({ userId: session.sub, action: "USER_CREATED", entity: "User", entityId: user.id, newValue: { ...body, password: undefined } });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
