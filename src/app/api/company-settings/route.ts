import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireSession, handleApiError } from "@/lib/api-helpers";
import { companySettingsSchema } from "@/lib/validation/misc";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    let settings = await prisma.companySettings.findFirst();
    if (!settings) {
      settings = await prisma.companySettings.create({ data: { companyName: "VEEKAY", weeklyOffDays: [0] } });
    }
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN"]);
    const body = companySettingsSchema.parse(await request.json());

    const existing = await prisma.companySettings.findFirst();
    const settings = existing
      ? await prisma.companySettings.update({
          where: { id: existing.id },
          data: {
            companyName: body.companyName,
            address: body.address || null,
            logoUrl: body.logoUrl || null,
            managerName: body.managerName || null,
            statutoryRef: body.statutoryRef || null,
            weeklyOffDays: body.weeklyOffDays,
          },
        })
      : await prisma.companySettings.create({
          data: {
            companyName: body.companyName,
            address: body.address || null,
            logoUrl: body.logoUrl || null,
            managerName: body.managerName || null,
            statutoryRef: body.statutoryRef || null,
            weeklyOffDays: body.weeklyOffDays,
          },
        });

    await writeAuditLog({ userId: session.sub, action: "COMPANY_SETTINGS_UPDATED", entity: "CompanySettings", entityId: settings.id, newValue: body });

    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
