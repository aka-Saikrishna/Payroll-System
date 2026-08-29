import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-helpers";

export async function GET() {
  try {
    await requireSession();
    const period = await prisma.payrollPeriod.findFirst({
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    if (period) return NextResponse.json({ period });

    const now = new Date();
    return NextResponse.json({
      period: null,
      suggested: { year: now.getFullYear(), month: now.getMonth() + 1 },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
