-- AlterTable: per-employee entitlement to the Full Attendance Bonus.
-- Defaults true so existing employees are unaffected; the bonus remains
-- gated by the period toggle, attendance, and the rule's effective dates.
ALTER TABLE "employee_salary_config" ADD COLUMN "bonusApplicable" BOOLEAN NOT NULL DEFAULT true;
