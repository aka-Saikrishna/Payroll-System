import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function writeAuditLog(entry: {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      oldValue: entry.oldValue ?? undefined,
      newValue: entry.newValue ?? undefined,
    },
  });
}
