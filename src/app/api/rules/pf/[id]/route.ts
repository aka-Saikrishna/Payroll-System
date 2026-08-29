import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { pfRuleSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = pfRuleSchema.parse(await request.json());
    const before = await prisma.pfRule.findUnique({ where: { id: params.id } });
    if (!before) throw new ApiError(404, "PF rule not found");

    const rule = await prisma.pfRule.update({
      where: { id: params.id },
      data: {
        ratePercent: body.ratePercent,
        wageCeiling: body.wageCeiling ?? null,
        enabled: body.enabled,
        effectiveFrom: new Date(body.effectiveFrom),
      },
    });
    await writeAuditLog({ userId: session.sub, action: "PF_RULE_UPDATED", entity: "PfRule", entityId: rule.id, oldValue: JSON.parse(JSON.stringify(before)), newValue: body });
    return NextResponse.json({ rule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    await prisma.pfRule.delete({ where: { id: params.id } });
    await writeAuditLog({ userId: session.sub, action: "PF_RULE_DELETED", entity: "PfRule", entityId: params.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
