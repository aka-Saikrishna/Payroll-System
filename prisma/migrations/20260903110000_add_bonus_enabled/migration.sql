-- AlterTable: add bonusEnabled to payroll_periods
ALTER TABLE "payroll_periods" ADD COLUMN "bonusEnabled" BOOLEAN NOT NULL DEFAULT false;
