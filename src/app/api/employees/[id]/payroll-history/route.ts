import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const records = await prisma.payrollRecord.findMany({
      where: { employeeId: params.id },
      include: { payrollPeriod: { select: { year: true, month: true } } },
      orderBy: [{ payrollPeriod: { year: "desc" } }, { payrollPeriod: { month: "desc" } }],
    });

    return NextResponse.json({
      records: records.map((r) => ({
        id: r.id,
        year: r.payrollPeriod.year,
        month: r.payrollPeriod.month,
        netSalary: r.netSalary,
        status: r.status,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
