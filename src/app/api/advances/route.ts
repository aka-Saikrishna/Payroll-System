import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, handleApiError, paginationParams } from "@/lib/api-helpers";
import { advanceSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim();
    const { page, pageSize, skip, take } = paginationParams(searchParams);

    const where: Prisma.SalaryAdvanceWhereInput = search
      ? {
          employee: {
            OR: [
              { employeeCode: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          },
        }
      : {};

    const [advances, total] = await Promise.all([
      prisma.salaryAdvance.findMany({
        where,
        include: { employee: { select: { id: true, employeeCode: true, name: true } } },
        orderBy: { advanceDate: "desc" },
        skip,
        take,
      }),
      prisma.salaryAdvance.count({ where }),
    ]);

    return NextResponse.json({ advances, total, page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = advanceSchema.parse(await request.json());

    const advance = await prisma.salaryAdvance.create({
      data: {
        employeeId: body.employeeId,
        advanceDate: new Date(body.advanceDate),
        amount: body.amount,
        reference: body.reference || null,
        remarks: body.remarks || null,
        payrollPeriodId: body.payrollPeriodId || null,
      },
      include: { employee: { select: { id: true, employeeCode: true, name: true } } },
    });

    await writeAuditLog({ userId: session.sub, action: "ADVANCE_CREATED", entity: "SalaryAdvance", entityId: advance.id, newValue: body });

    return NextResponse.json({ advance }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
