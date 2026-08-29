import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { ptRuleSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = ptRuleSchema.parse(await request.json());
    const before = await prisma.ptRule.findUnique({ where: { id: params.id } });
    if (!before) throw new ApiError(404, "PT rule not found");

    const rule = await prisma.ptRule.update({
      where: { id: params.id },
      data: {
        minSalary: body.minSalary,
        maxSalary: body.maxSalary ?? null,
        ptAmount: body.ptAmount,
        enabled: body.enabled,
        effectiveFrom: new Date(body.effectiveFrom),
      },
    });
    await writeAuditLog({ userId: session.sub, action: "PT_RULE_UPDATED", entity: "PtRule", entityId: rule.id, oldValue: JSON.parse(JSON.stringify(before)), newValue: body });
    return NextResponse.json({ rule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(["ADMIN"]);
    await prisma.ptRule.delete({ where: { id: params.id } });
    await writeAuditLog({ userId: session.sub, action: "PT_RULE_DELETED", entity: "PtRule", entityId: params.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
