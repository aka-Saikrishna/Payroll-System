-- AlterTable: remove rttApplicable from employee_salary_config
ALTER TABLE "employee_salary_config" DROP COLUMN "rttApplicable";

-- AlterTable: remove rtt and appliedRttRuleId from payroll_records
ALTER TABLE "payroll_records" DROP COLUMN "rtt";
ALTER TABLE "payroll_records" DROP COLUMN "appliedRttRuleId";

-- DropTable: rtt_rules
DROP TABLE "rtt_rules";
