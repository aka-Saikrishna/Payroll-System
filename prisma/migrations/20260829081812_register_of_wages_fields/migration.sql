-- AlterTable
ALTER TABLE "company_settings" ADD COLUMN     "managerName" TEXT,
ADD COLUMN     "statutoryRef" TEXT DEFAULT 'Vide rule 6 A of A.P. PAYMENT OF Wages Rules, 1937';

-- AlterTable
ALTER TABLE "employee_salary_config" ADD COLUMN     "basicSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "conveyance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hra" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payroll_records" ADD COLUMN     "basicSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "canteenCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "conveyance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "dailyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hra" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "otAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "otDays" DECIMAL(6,2) NOT NULL DEFAULT 0;
