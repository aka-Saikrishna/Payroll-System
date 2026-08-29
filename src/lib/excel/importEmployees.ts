import { ParsedRow } from "./parse";

export interface ValidatedEmployeeRow {
  employeeCode: string;
  name: string;
  mobile: string;
  email: string;
  department: string;
  designation: string;
  joiningDate: string;
  basicSalary: number;
  hra: number;
  conveyance: number;
  monthlySalary: number;
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  rttApplicable: boolean;
  paidLeaveApplicable: boolean;
  isUpdate: boolean;
}

function parseBoolean(v: string): boolean {
  return ["true", "yes", "1", "y"].includes(v.trim().toLowerCase());
}

export function validateEmployeeRows(rows: ParsedRow[], existingCodes: Set<string>) {
  const errors: { row: number; message: string }[] = [];
  const validRows: ValidatedEmployeeRow[] = [];
  const seenInFile = new Set<string>();
  let newRecords = 0;
  let updatedRecords = 0;
  let duplicateRecords = 0;

  for (const row of rows) {
    const v = row.values;
    const employeeCode = (v["Employee ID"] || v["Employee ID *"] || "").trim();
    const name = (v["Employee Name"] || v["Employee Name *"] || "").trim();
    const basicRaw = (v["Basic Salary"] || v["Basic Salary *"] || "").trim();
    const hraRaw = (v["HRA"] || "").trim();
    const conveyanceRaw = (v["Conveyance"] || "").trim();

    if (!employeeCode) {
      errors.push({ row: row.rowNumber, message: "Employee ID missing" });
      continue;
    }
    if (!name) {
      errors.push({ row: row.rowNumber, message: "Employee Name missing" });
      continue;
    }
    const basicSalary = Number(basicRaw);
    if (!basicRaw || Number.isNaN(basicSalary) || basicSalary < 0) {
      errors.push({ row: row.rowNumber, message: "Basic Salary is missing or invalid" });
      continue;
    }
    const hra = hraRaw ? Number(hraRaw) : 0;
    const conveyance = conveyanceRaw ? Number(conveyanceRaw) : 0;
    if (Number.isNaN(hra) || hra < 0) {
      errors.push({ row: row.rowNumber, message: "HRA is invalid" });
      continue;
    }
    if (Number.isNaN(conveyance) || conveyance < 0) {
      errors.push({ row: row.rowNumber, message: "Conveyance is invalid" });
      continue;
    }
    const monthlySalary = basicSalary + hra + conveyance;

    let joiningDate = "";
    const joiningRaw = v["Joining Date"];
    if (joiningRaw) {
      const parsed = new Date(joiningRaw);
      if (Number.isNaN(parsed.getTime())) {
        errors.push({ row: row.rowNumber, message: "Invalid date in Joining Date" });
        continue;
      }
      joiningDate = parsed.toISOString().slice(0, 10);
    }

    if (seenInFile.has(employeeCode)) {
      duplicateRecords++;
      continue;
    }
    seenInFile.add(employeeCode);

    const isUpdate = existingCodes.has(employeeCode);
    if (isUpdate) updatedRecords++;
    else newRecords++;

    validRows.push({
      employeeCode,
      name,
      mobile: v["Mobile"] || "",
      email: v["Email"] || "",
      department: v["Department"] || "",
      designation: v["Designation"] || "",
      joiningDate,
      basicSalary,
      hra,
      conveyance,
      monthlySalary,
      pfApplicable: parseBoolean(v["PF Applicable"] || ""),
      esiApplicable: parseBoolean(v["ESI Applicable"] || ""),
      ptApplicable: v["PT Applicable"] != null ? parseBoolean(v["PT Applicable"]) : true,
      rttApplicable: parseBoolean(v["RTT Applicable"] || ""),
      paidLeaveApplicable: parseBoolean(v["Paid Leave Applicable"] || ""),
      isUpdate,
    });
  }

  return {
    totalRecords: rows.length,
    newRecords,
    updatedRecords,
    duplicateRecords,
    errorRecords: errors.length,
    errors,
    validRows,
  };
}
