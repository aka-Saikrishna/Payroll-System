import { ParsedRow } from "./parse";

export interface ValidatedHolidayRow {
  date: string;
  name: string;
  type: "PUBLIC_HOLIDAY" | "COMPANY_HOLIDAY" | "OPTIONAL_HOLIDAY";
}

const TYPE_ALIASES: Record<string, ValidatedHolidayRow["type"]> = {
  "PUBLIC HOLIDAY": "PUBLIC_HOLIDAY",
  PUBLIC_HOLIDAY: "PUBLIC_HOLIDAY",
  "COMPANY HOLIDAY": "COMPANY_HOLIDAY",
  COMPANY_HOLIDAY: "COMPANY_HOLIDAY",
  "OPTIONAL HOLIDAY": "OPTIONAL_HOLIDAY",
  OPTIONAL_HOLIDAY: "OPTIONAL_HOLIDAY",
};

export function validateHolidayRows(rows: ParsedRow[], existingDates: Set<string>) {
  const errors: { row: number; message: string }[] = [];
  const validRows: ValidatedHolidayRow[] = [];
  const seen = new Set<string>();
  let newRecords = 0;
  let updatedRecords = 0;
  let duplicateRecords = 0;

  for (const row of rows) {
    const v = row.values;
    const dateRaw = (v["Date"] || v["Date *"] || "").trim();
    const name = (v["Holiday Name"] || v["Holiday Name *"] || "").trim();
    const typeRaw = (v["Holiday Type"] || "").trim().toUpperCase();

    const parsedDate = new Date(dateRaw);
    if (!dateRaw || Number.isNaN(parsedDate.getTime())) {
      errors.push({ row: row.rowNumber, message: "Invalid date" });
      continue;
    }
    if (!name) {
      errors.push({ row: row.rowNumber, message: "Holiday name missing" });
      continue;
    }
    const type = TYPE_ALIASES[typeRaw] || "PUBLIC_HOLIDAY";
    const dateKey = parsedDate.toISOString().slice(0, 10);

    if (seen.has(dateKey)) {
      duplicateRecords++;
      continue;
    }
    seen.add(dateKey);

    if (existingDates.has(dateKey)) updatedRecords++;
    else newRecords++;

    validRows.push({ date: dateKey, name, type });
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
