import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { reopenPayrollPeriod } from "@/lib/payroll/payrollService";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const reopenSchema = z.object({ reason: z.string().trim().min(1, "A reason is required to reopen finalized payroll") });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = reopenSchema.parse(await request.json());
    await reopenPayrollPeriod(params.id, session.sub, body.reason);
    const period = await prisma.payrollPeriod.findUnique({ where: { id: params.id } });
    return NextResponse.json({ period });
  } catch (error) {
    return handleApiError(error);
  }
}
