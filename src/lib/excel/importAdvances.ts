import { ParsedRow } from "./parse";

export interface ValidatedAdvanceRow {
  employeeId: string;
  advanceDate: string;
  amount: number;
  reference: string;
  remarks: string;
}

export function validateAdvanceRows(rows: ParsedRow[], employeeCodeToId: Map<string, string>) {
  const errors: { row: number; message: string }[] = [];
  const validRows: ValidatedAdvanceRow[] = [];

  for (const row of rows) {
    const v = row.values;
    const employeeCode = (v["Employee ID"] || v["Employee ID *"] || "").trim();
    const dateRaw = (v["Date"] || v["Date *"] || "").trim();
    const amountRaw = (v["Amount"] || v["Amount *"] || "").trim();

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
    const amount = Number(amountRaw);
    if (!amountRaw || Number.isNaN(amount) || amount < 0) {
      errors.push({ row: row.rowNumber, message: "Amount is missing or invalid" });
      continue;
    }

    validRows.push({
      employeeId,
      advanceDate: parsedDate.toISOString().slice(0, 10),
      amount,
      reference: v["Reference"] || "",
      remarks: v["Remarks"] || "",
    });
  }

  return {
    totalRecords: rows.length,
    newRecords: validRows.length,
    updatedRecords: 0,
    duplicateRecords: 0,
    errorRecords: errors.length,
    errors,
    validRows,
  };
}
