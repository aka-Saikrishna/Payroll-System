import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { esiRuleSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = esiRuleSchema.parse(await request.json());
    const before = await prisma.esiRule.findUnique({ where: { id: params.id } });
    if (!before) throw new ApiError(404, "ESI rule not found");

    const rule = await prisma.esiRule.update({
      where: { id: params.id },
      data: {
        ratePercent: body.ratePercent,
        wageCeiling: body.wageCeiling ?? null,
        enabled: body.enabled,
        effectiveFrom: new Date(body.effectiveFrom),
      },
    });
    await writeAuditLog({ userId: session.sub, action: "ESI_RULE_UPDATED", entity: "EsiRule", entityId: rule.id, oldValue: JSON.parse(JSON.stringify(before)), newValue: body });
    return NextResponse.json({ rule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    await prisma.esiRule.delete({ where: { id: params.id } });
    await writeAuditLog({ userId: session.sub, action: "ESI_RULE_DELETED", entity: "EsiRule", entityId: params.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
