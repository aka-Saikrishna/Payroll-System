import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Fictional demo workforce, shaped like a real "Payment Register - Register
 * of Wages/Salaries" (A.P. Payment of Wages Rules 1937, Rule 6A) so every
 * feature (Basic/HRA/Conveyance split, advances, canteen charges, OT days,
 * the paid-leave toggle) has realistic sample data to exercise.
 *
 * This is placeholder data only — no real company or employee information.
 * To load your real workforce, either run this seed against your own local
 * database after editing the array below, or add employees through the
 * Employees screen / Excel import once the app is running.
 */
const DEMO_EMPLOYEES = [
  { name: "Aarav Sharma", basic: 32000, hra: 0, conveyance: 0, worked: 31, absent: 0, advance: 0, canteen: 500, otDays: 3 },
  { name: "Priya Nair", basic: 28000, hra: 0, conveyance: 0, worked: 29, absent: 2, advance: 0, canteen: 300, otDays: 2 },
  { name: "Rohit Verma", basic: 45000, hra: 0, conveyance: 0, worked: 30, absent: 1, advance: 5000, canteen: 0, otDays: 4 },
  { name: "Sneha Reddy", basic: 24000, hra: 0, conveyance: 0, worked: 31, absent: 0, advance: 0, canteen: 0, otDays: 0 },
  { name: "Vikram Singh", basic: 60000, hra: 0, conveyance: 0, worked: 22, absent: 9, advance: 0, canteen: 800, otDays: 0 },
  { name: "Ananya Das", basic: 18000, hra: 6000, conveyance: 2000, worked: 30, absent: 1, advance: 0, canteen: 0, otDays: 1 },
  { name: "Karthik Iyer", basic: 15000, hra: 5000, conveyance: 2000, worked: 31, absent: 0, advance: 2000, canteen: 0, otDays: 0 },
  { name: "Meera Joshi", basic: 12000, hra: 4000, conveyance: 1500, worked: 28, absent: 3, advance: 0, canteen: 0, otDays: 1 },
];

async function main() {
  const adminPasswordHash = await bcrypt.hash("Admin@123", 10);
  await prisma.user.upsert({
    where: { email: "admin@veekay.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@veekay.com",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const companySettingsData = {
    companyName: "VEEKAY",
    address: "",
    managerName: "",
    statutoryRef: "Vide rule 6 A of A.P. PAYMENT OF Wages Rules, 1937",
    weeklyOffDays: [0] as number[], // Sunday
  };
  await prisma.companySettings.upsert({
    where: { id: (await prisma.companySettings.findFirst())?.id ?? "seed-company" },
    update: companySettingsData,
    create: { id: "seed-company", ...companySettingsData },
  });

  const today = new Date();
  const effectiveFrom = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));

  await prisma.pfRule.upsert({
    where: { id: "seed-pf-rule" },
    update: {},
    create: { id: "seed-pf-rule", ratePercent: 12, wageCeiling: null, enabled: true, effectiveFrom },
  });
  await prisma.esiRule.upsert({
    where: { id: "seed-esi-rule" },
    update: {},
    create: { id: "seed-esi-rule", ratePercent: 0.75, wageCeiling: 21000, enabled: true, effectiveFrom },
  });
  await prisma.ptRule.upsert({
    where: { id: "seed-pt-rule-1" },
    update: {},
    create: { id: "seed-pt-rule-1", minSalary: 0, maxSalary: 15000, ptAmount: 0, enabled: true, effectiveFrom },
  });
  await prisma.ptRule.upsert({
    where: { id: "seed-pt-rule-2" },
    update: {},
    create: { id: "seed-pt-rule-2", minSalary: 15001, maxSalary: 20000, ptAmount: 150, enabled: true, effectiveFrom },
  });
  await prisma.ptRule.upsert({
    where: { id: "seed-pt-rule-3" },
    update: {},
    create: { id: "seed-pt-rule-3", minSalary: 20001, maxSalary: null, ptAmount: 200, enabled: true, effectiveFrom },
  });
  await prisma.bonusRule.upsert({
    where: { id: "seed-bonus-rule" },
    update: { enabled: true },
    create: {
      id: "seed-bonus-rule",
      name: "Full Attendance Bonus",
      amount: 200,
      enabled: true,
      effectiveFrom,
    },
  });

  // Clear any previously seeded workforce (and everything cascading from it:
  // attendance, advances, payroll records) before loading the demo roster.
  await prisma.employee.deleteMany({});
  await prisma.holiday.deleteMany({});

  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const created: { id: string; index: number }[] = [];

  for (let i = 0; i < DEMO_EMPLOYEES.length; i++) {
    const e = DEMO_EMPLOYEES[i];
    const employeeCode = `EMP${String(i + 1).padStart(3, "0")}`;
    const monthlySalary = e.basic + e.hra + e.conveyance;

    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        name: e.name,
        status: "ACTIVE",
        joiningDate: new Date(Date.UTC(2024, 0, 1)),
        salaryConfig: {
          create: {
            basicSalary: e.basic,
            hra: e.hra,
            conveyance: e.conveyance,
            monthlySalary,
            pfApplicable: i % 2 === 0,
            esiApplicable: i % 3 === 0,
            ptApplicable: true,
            paidLeaveApplicable: i % 2 === 0,
          },
        },
      },
    });
    created.push({ id: employee.id, index: i });

    // Attendance for the month: `worked` PRESENT days then `absent` ABSENT days.
    const attendanceRows = [];
    for (let d = 1; d <= daysInMonth; d++) {
      attendanceRows.push({
        employeeId: employee.id,
        attendanceDate: new Date(Date.UTC(year, month - 1, d)),
        status: (d <= e.worked ? "PRESENT" : "ABSENT") as "PRESENT" | "ABSENT",
      });
    }
    await prisma.attendance.createMany({ data: attendanceRows });

    if (e.advance > 0) {
      await prisma.salaryAdvance.create({
        data: {
          employeeId: employee.id,
          advanceDate: new Date(Date.UTC(year, month - 1, 5)),
          amount: e.advance,
          reference: `ADV-${employeeCode}`,
        },
      });
    }
  }

  const { getOrCreatePayrollPeriod } = await import("../src/lib/payroll/period");
  const { generatePayrollForPeriod, updatePayrollExtras } = await import("../src/lib/payroll/payrollService");
  const period = await getOrCreatePayrollPeriod(year, month);
  await generatePayrollForPeriod(period.id, null);

  // Apply the demo Canteen Charges and OT Days.
  for (const { id, index } of created) {
    const e = DEMO_EMPLOYEES[index];
    if (e.canteen === 0 && e.otDays === 0) continue;
    const record = await prisma.payrollRecord.findUnique({
      where: { payrollPeriodId_employeeId: { payrollPeriodId: period.id, employeeId: id } },
    });
    if (record) await updatePayrollExtras(record.id, { canteenCharges: e.canteen, otDays: e.otDays, otherAmount: 0 }, null);
  }

  console.log("Seed complete. Admin login: admin@veekay.com / Admin@123");
  console.log(`Loaded ${DEMO_EMPLOYEES.length} demo employees and generated payroll for ${month}/${year}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
