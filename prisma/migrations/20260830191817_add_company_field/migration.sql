-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "company" TEXT NOT NULL DEFAULT 'VPPL';

-- CreateIndex
CREATE INDEX "employees_company_idx" ON "employees"("company");
