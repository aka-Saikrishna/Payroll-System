-- AlterTable: add otherAmount to payroll_records
ALTER TABLE "payroll_records" ADD COLUMN "otherAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0;
