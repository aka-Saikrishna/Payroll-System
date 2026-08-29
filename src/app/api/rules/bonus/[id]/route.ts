import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { bonusRuleSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = bonusRuleSchema.parse(await request.json());
    const before = await prisma.bonusRule.findUnique({ where: { id: params.id } });
    if (!before) throw new ApiError(404, "Bonus rule not found");

    const rule = await prisma.bonusRule.update({
      where: { id: params.id },
      data: { name: body.name, amount: body.amount, enabled: body.enabled, effectiveFrom: new Date(body.effectiveFrom) },
    });
    await writeAuditLog({ userId: session.sub, action: "BONUS_RULE_UPDATED", entity: "BonusRule", entityId: rule.id, oldValue: JSON.parse(JSON.stringify(before)), newValue: body });
    return NextResponse.json({ rule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    await prisma.bonusRule.delete({ where: { id: params.id } });
    await writeAuditLog({ userId: session.sub, action: "BONUS_RULE_DELETED", entity: "BonusRule", entityId: params.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
