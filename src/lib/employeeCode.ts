import { prisma } from "@/lib/prisma";

/**
 * Auto-generates the next sequential employee code (EMP001, EMP002, ...).
 * Employee ID is no longer entered manually in the UI (see EmployeeForm.tsx).
 */
export async function generateNextEmployeeCode(): Promise<string> {
  const employees = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: "EMP" } },
    select: { employeeCode: true },
  });

  let max = 0;
  for (const e of employees) {
    const match = /^EMP(\d+)$/i.exec(e.employeeCode);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }

  return `EMP${String(max + 1).padStart(3, "0")}`;
}
