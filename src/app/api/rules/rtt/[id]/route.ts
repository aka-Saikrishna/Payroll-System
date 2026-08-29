import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { rttRuleSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = rttRuleSchema.parse(await request.json());
    const before = await prisma.rttRule.findUnique({ where: { id: params.id } });
    if (!before) throw new ApiError(404, "RTT rule not found");

    const rule = await prisma.rttRule.update({
      where: { id: params.id },
      data: { amount: body.amount, enabled: body.enabled, effectiveFrom: new Date(body.effectiveFrom) },
    });
    await writeAuditLog({ userId: session.sub, action: "RTT_RULE_UPDATED", entity: "RttRule", entityId: rule.id, oldValue: JSON.parse(JSON.stringify(before)), newValue: body });
    return NextResponse.json({ rule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    await prisma.rttRule.delete({ where: { id: params.id } });
    await writeAuditLog({ userId: session.sub, action: "RTT_RULE_DELETED", entity: "RttRule", entityId: params.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
