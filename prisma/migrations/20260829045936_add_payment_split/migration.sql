-- AlterTable
ALTER TABLE "payroll_records" ADD COLUMN     "cashAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "chequeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
