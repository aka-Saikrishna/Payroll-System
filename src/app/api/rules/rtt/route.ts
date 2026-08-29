import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, handleApiError } from "@/lib/api-helpers";
import { rttRuleSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    const rules = await prisma.rttRule.findMany({ orderBy: { effectiveFrom: "desc" } });
    return NextResponse.json({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = rttRuleSchema.parse(await request.json());
    const rule = await prisma.rttRule.create({
      data: { amount: body.amount, enabled: body.enabled, effectiveFrom: new Date(body.effectiveFrom) },
    });
    await writeAuditLog({ userId: session.sub, action: "RTT_RULE_CREATED", entity: "RttRule", entityId: rule.id, newValue: body });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
