import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { updatePayrollExtras } from "@/lib/payroll/payrollService";
import { z } from "zod";

const extrasSchema = z.object({
  canteenCharges: z.coerce.number().min(0, "Canteen charges cannot be negative"),
  otDays: z.coerce.number().min(0, "OT days cannot be negative"),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const body = extrasSchema.parse(await request.json());
    const record = await updatePayrollExtras(params.id, body, session.sub);
    return NextResponse.json({ record });
  } catch (error) {
    return handleApiError(error);
  }
}
