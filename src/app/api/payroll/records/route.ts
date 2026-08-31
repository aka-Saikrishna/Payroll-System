import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const searchParams = request.nextUrl.searchParams;
    const periodId = searchParams.get("periodId");
    if (!periodId) throw new ApiError(400, "periodId is required");
    const search = searchParams.get("search")?.trim();
    const employeeIdsParam = searchParams.get("employeeIds")?.trim();
    const employeeIds = employeeIdsParam ? employeeIdsParam.split(",").filter(Boolean) : null;

    const company = searchParams.get("company")?.trim() || "VPPL";

    const where: Prisma.PayrollRecordWhereInput = {
      payrollPeriodId: periodId,
      employee: {
        company,
        ...(employeeIds ? { id: { in: employeeIds } } : {}),
        ...(search
          ? {
              OR: [
                { employeeCode: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    };

    const records = await prisma.payrollRecord.findMany({
      where,
      include: { employee: { select: { id: true, employeeCode: true, name: true, department: true } } },
      orderBy: { employee: { employeeCode: "asc" } },
    });

    return NextResponse.json({ records });
  } catch (error) {
    return handleApiError(error);
  }
}
