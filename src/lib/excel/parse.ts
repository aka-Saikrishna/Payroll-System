import ExcelJS from "exceljs";

export interface ParsedRow {
  rowNumber: number; // 1-indexed spreadsheet row (includes header row offset)
  values: Record<string, string>;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];

export class ExcelParseError extends Error {}

export function assertValidExcelFile(fileName: string, size: number) {
  const lower = fileName.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new ExcelParseError("Only .xlsx or .xls files are supported");
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new ExcelParseError("File exceeds the 10MB size limit");
  }
}

/**
 * Parses the first worksheet into header-keyed rows. Cell values are
 * coerced to plain strings/text — formulas are never evaluated or trusted;
 * we only ever read ExcelJS's cached `.text`/`.result` for a formula cell,
 * never re-execute it.
 */
export async function parseWorkbookFirstSheet(buffer: Buffer): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ExcelParseError("The uploaded file has no worksheets");

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: ParsedRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string> = {};
    let hasContent = false;
    headers.forEach((header, idx) => {
      if (!header) return;
      const cell = row.getCell(idx + 1);
      let raw: unknown = cell.value;
      if (raw && typeof raw === "object" && "result" in (raw as object)) {
        raw = (raw as { result: unknown }).result;
      } else if (raw && typeof raw === "object" && "text" in (raw as object)) {
        raw = (raw as { text: unknown }).text;
      }
      const text = raw == null ? "" : String(raw).trim();
      if (text !== "") hasContent = true;
      values[header] = text;
    });
    if (hasContent) rows.push({ rowNumber, values });
  });

  return { headers, rows };
}
