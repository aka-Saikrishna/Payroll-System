import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { toggleBonusForPeriod } from "@/lib/payroll/payrollService";
import { z } from "zod";

const toggleSchema = z.object({
  enabled: z.boolean(),
  company: z.string().default("VPPL"),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = toggleSchema.parse(await request.json());
    const result = await toggleBonusForPeriod(params.id, body.enabled, body.company, session.sub);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
