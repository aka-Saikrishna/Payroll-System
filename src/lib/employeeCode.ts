import { prisma } from "@/lib/prisma";

const COMPANY_PREFIXES: Record<string, string> = {
  VPPL: "EMP",
  VPFL: "VPF",
};

export async function generateNextEmployeeCode(company: string = "VPPL"): Promise<string> {
  const prefix = COMPANY_PREFIXES[company] || "EMP";
  const employees = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: prefix } },
    select: { employeeCode: true },
  });

  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`, "i");
  for (const e of employees) {
    const match = re.exec(e.employeeCode);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }

  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
