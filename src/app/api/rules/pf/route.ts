import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, handleApiError } from "@/lib/api-helpers";
import { pfRuleSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    const rules = await prisma.pfRule.findMany({ orderBy: { effectiveFrom: "desc" } });
    return NextResponse.json({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = pfRuleSchema.parse(await request.json());
    const rule = await prisma.pfRule.create({
      data: {
        ratePercent: body.ratePercent,
        wageCeiling: body.wageCeiling ?? null,
        enabled: body.enabled,
        effectiveFrom: new Date(body.effectiveFrom),
      },
    });
    await writeAuditLog({ userId: session.sub, action: "PF_RULE_CREATED", entity: "PfRule", entityId: rule.id, newValue: body });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
