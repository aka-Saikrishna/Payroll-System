-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PAYROLL_MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('PUBLIC_HOLIDAY', 'COMPANY_HOLIDAY', 'OPTIONAL_HOLIDAY');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'WEEKLY_OFF', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'REVIEW', 'FINALIZED');

-- CreateEnum
CREATE TYPE "ExcelImportType" AS ENUM ('EMPLOYEE', 'ATTENDANCE', 'ADVANCE', 'HOLIDAY', 'PAYROLL');

-- CreateEnum
CREATE TYPE "ExcelImportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "resetToken" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "joiningDate" DATE,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salary_config" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "monthlySalary" DECIMAL(12,2) NOT NULL,
    "pfApplicable" BOOLEAN NOT NULL DEFAULT false,
    "esiApplicable" BOOLEAN NOT NULL DEFAULT false,
    "ptApplicable" BOOLEAN NOT NULL DEFAULT true,
    "rttApplicable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_salary_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HolidayType" NOT NULL DEFAULT 'PUBLIC_HOLIDAY',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "weeklyOffDays" INTEGER NOT NULL,
    "holidayDays" INTEGER NOT NULL,
    "calendarDays" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "calendarVersion" INTEGER NOT NULL DEFAULT 1,
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_advances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "advanceDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "remarks" TEXT,
    "payrollPeriodId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Full Attendance Bonus',
    "amount" DECIMAL(12,2) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pf_rules" (
    "id" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "wageCeiling" DECIMAL(12,2),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pf_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esi_rules" (
    "id" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "wageCeiling" DECIMAL(12,2),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "esi_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pt_rules" (
    "id" TEXT NOT NULL,
    "minSalary" DECIMAL(12,2) NOT NULL,
    "maxSalary" DECIMAL(12,2),
    "ptAmount" DECIMAL(12,2) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pt_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rtt_rules" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rtt_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "monthlySalary" DECIMAL(12,2) NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "presentDays" INTEGER NOT NULL,
    "actualAbsentDays" INTEGER NOT NULL,
    "paidLeave" INTEGER NOT NULL,
    "paidLeaveUsed" INTEGER NOT NULL,
    "deductibleAbsentDays" INTEGER NOT NULL,
    "payableDays" INTEGER NOT NULL,
    "absenceDeduction" DECIMAL(12,2) NOT NULL,
    "salaryAfterAbsence" DECIMAL(12,2) NOT NULL,
    "bonusEligible" BOOLEAN NOT NULL DEFAULT false,
    "bonus" DECIMAL(12,2) NOT NULL,
    "totalEarnings" DECIMAL(12,2) NOT NULL,
    "esi" DECIMAL(12,2) NOT NULL,
    "pf" DECIMAL(12,2) NOT NULL,
    "pt" DECIMAL(12,2) NOT NULL,
    "rtt" DECIMAL(12,2) NOT NULL,
    "advance" DECIMAL(12,2) NOT NULL,
    "totalDeductions" DECIMAL(12,2) NOT NULL,
    "netSalary" DECIMAL(12,2) NOT NULL,
    "appliedPfRateId" TEXT,
    "appliedEsiRuleId" TEXT,
    "appliedPtRuleId" TEXT,
    "appliedRttRuleId" TEXT,
    "appliedBonusRuleId" TEXT,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excel_imports" (
    "id" TEXT NOT NULL,
    "importType" "ExcelImportType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "newRecords" INTEGER NOT NULL DEFAULT 0,
    "updatedRecords" INTEGER NOT NULL DEFAULT 0,
    "duplicateRecords" INTEGER NOT NULL DEFAULT 0,
    "errorRecords" INTEGER NOT NULL DEFAULT 0,
    "status" "ExcelImportStatus" NOT NULL DEFAULT 'PENDING',
    "importedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excel_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excel_import_errors" (
    "id" TEXT NOT NULL,
    "excelImportId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "errorMessage" TEXT NOT NULL,

    CONSTRAINT "excel_import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'VEEKAY',
    "address" TEXT,
    "logoUrl" TEXT,
    "weeklyOffDays" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");

-- CreateIndex
CREATE INDEX "employees_name_idx" ON "employees"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employee_salary_config_employeeId_key" ON "employee_salary_config"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_year_month_key" ON "payroll_periods"("year", "month");

-- CreateIndex
CREATE INDEX "attendance_attendanceDate_idx" ON "attendance"("attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_employeeId_attendanceDate_key" ON "attendance"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "salary_advances_employeeId_idx" ON "salary_advances"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_payrollPeriodId_employeeId_key" ON "payroll_records"("payrollPeriodId", "employeeId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "employee_salary_config" ADD CONSTRAINT "employee_salary_config_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excel_imports" ADD CONSTRAINT "excel_imports_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excel_import_errors" ADD CONSTRAINT "excel_import_errors_excelImportId_fkey" FOREIGN KEY ("excelImportId") REFERENCES "excel_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
