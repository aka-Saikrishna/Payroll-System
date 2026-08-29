import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, handleApiError } from "@/lib/api-helpers";
import { ptRuleSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    const rules = await prisma.ptRule.findMany({ orderBy: [{ effectiveFrom: "desc" }, { minSalary: "asc" }] });
    return NextResponse.json({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = ptRuleSchema.parse(await request.json());
    const rule = await prisma.ptRule.create({
      data: {
        minSalary: body.minSalary,
        maxSalary: body.maxSalary ?? null,
        ptAmount: body.ptAmount,
        enabled: body.enabled,
        effectiveFrom: new Date(body.effectiveFrom),
      },
    });
    await writeAuditLog({ userId: session.sub, action: "PT_RULE_CREATED", entity: "PtRule", entityId: rule.id, newValue: body });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
