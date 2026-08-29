import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-helpers";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const period = await prisma.payrollPeriod.findUnique({ where: { id: params.id } });
    if (!period) throw new ApiError(404, "Payroll period not found");
    return NextResponse.json({ period });
  } catch (error) {
    return handleApiError(error);
  }
}
