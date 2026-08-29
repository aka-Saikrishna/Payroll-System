import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { finalizePayrollPeriod } from "@/lib/payroll/payrollService";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    await finalizePayrollPeriod(params.id, session.sub);
    const period = await prisma.payrollPeriod.findUnique({ where: { id: params.id } });
    return NextResponse.json({ period });
  } catch (error) {
    return handleApiError(error);
  }
}
