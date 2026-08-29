import { ParsedRow } from "./parse";

export interface ValidatedAttendanceRow {
  employeeId: string;
  employeeCode: string;
  attendanceDate: string;
  status: "PRESENT" | "ABSENT" | "WEEKLY_OFF" | "HOLIDAY";
}

const STATUS_ALIASES: Record<string, ValidatedAttendanceRow["status"]> = {
  PRESENT: "PRESENT",
  P: "PRESENT",
  ABSENT: "ABSENT",
  A: "ABSENT",
  "WEEKLY OFF": "WEEKLY_OFF",
  WEEKLY_OFF: "WEEKLY_OFF",
  WO: "WEEKLY_OFF",
  HOLIDAY: "HOLIDAY",
  H: "HOLIDAY",
};

export function validateAttendanceRows(rows: ParsedRow[], employeeCodeToId: Map<string, string>) {
  const errors: { row: number; message: string }[] = [];
  const validRows: ValidatedAttendanceRow[] = [];
  const seen = new Set<string>();
  let newRecords = 0;
  let duplicateRecords = 0;

  for (const row of rows) {
    const v = row.values;
    const employeeCode = (v["Employee ID"] || v["Employee ID *"] || "").trim();
    const dateRaw = (v["Date"] || v["Date *"] || "").trim();
    const statusRaw = (v["Status"] || v["Status *"] || "").trim().toUpperCase();

    if (!employeeCode) {
      errors.push({ row: row.rowNumber, message: "Employee ID missing" });
      continue;
    }
    const employeeId = employeeCodeToId.get(employeeCode);
    if (!employeeId) {
      errors.push({ row: row.rowNumber, message: `Unknown employee ID: ${employeeCode}` });
      continue;
    }
    const parsedDate = new Date(dateRaw);
    if (!dateRaw || Number.isNaN(parsedDate.getTime())) {
      errors.push({ row: row.rowNumber, message: "Invalid date" });
      continue;
    }
    const status = STATUS_ALIASES[statusRaw];
    if (!status) {
      errors.push({ row: row.rowNumber, message: `Invalid status: ${statusRaw || "(empty)"}` });
      continue;
    }

    const attendanceDate = parsedDate.toISOString().slice(0, 10);
    const key = `${employeeId}_${attendanceDate}`;
    if (seen.has(key)) {
      duplicateRecords++;
      continue;
    }
    seen.add(key);
    newRecords++;

    validRows.push({ employeeId, employeeCode, attendanceDate, status });
  }

  return {
    totalRecords: rows.length,
    newRecords,
    updatedRecords: 0,
    duplicateRecords,
    errorRecords: errors.length,
    errors,
    validRows,
  };
}
