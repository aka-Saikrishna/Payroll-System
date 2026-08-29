import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { generatePayrollForPeriod } from "@/lib/payroll/payrollService";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const result = await generatePayrollForPeriod(params.id, session.sub);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
