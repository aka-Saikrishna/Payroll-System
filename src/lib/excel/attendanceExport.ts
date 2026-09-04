import ExcelJS from "exceljs";
import { MONTH_NAMES } from "@/lib/date-utils";

export interface AttendanceExportRow {
  slNo: number;
  employeeCode: string;
  name: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  paidLeaveUsed: number;
  deductibleAbsentDays: number;
  payableDays: number;
}

export interface AttendanceExportHeader {
  companyName: string;
  year: number;
  month: number;
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const TOTAL_COLUMNS = 9;

/**
 * A deliberately minimal attendance sheet: who worked, how many days were
 * available, and how many they were present / absent for. Nothing salary
 * related — that lives in the Register of Wages export.
 */
export async function buildAttendanceWorkbook(
  header: AttendanceExportHeader,
  rows: AttendanceExportRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${MONTH_NAMES[header.month - 1]} ${header.year}`, {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  sheet.columns = [6, 14, 30, 12, 12, 12, 12, 13, 12].map((width) => ({ width }));

  function mergeAndSet(row: number, value: string, opts?: { bold?: boolean; size?: number }) {
    sheet.mergeCells(row, 1, row, TOTAL_COLUMNS);
    const cell = sheet.getCell(row, 1);
    cell.value = value;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { bold: opts?.bold ?? true, size: opts?.size ?? 10 };
  }

  mergeAndSet(1, "ATTENDANCE SHEET", { size: 13 });
  mergeAndSet(2, `M/s. ${header.companyName}`, { size: 10 });
  mergeAndSet(3, `For the month of ${MONTH_NAMES[header.month - 1].toUpperCase()} ${header.year}`, { size: 10 });
  sheet.getRow(4).height = 6;

  const headers = [
    "Sl. No",
    "Emp. Code",
    "Name of the Worker",
    "Working Days",
    "Present Days",
    "Absent Days",
    "Paid Leave Used",
    "Deductible Absent",
    "Payable Days",
  ];
  headers.forEach((label, i) => {
    const cell = sheet.getCell(5, i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = THIN_BORDER;
  });
  sheet.getRow(5).height = 24;

  let rowIdx = 6;
  for (const r of rows) {
    const values = [
      r.slNo,
      r.employeeCode,
      r.name,
      r.workingDays,
      r.presentDays,
      r.absentDays,
      r.paidLeaveUsed,
      r.deductibleAbsentDays,
      r.payableDays,
    ];
    values.forEach((v, i) => {
      const cell = sheet.getCell(rowIdx, i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.border = THIN_BORDER;
      cell.font = { size: 10 };
      // Codes and names read left; the day counts read centred.
      cell.alignment = { horizontal: i === 1 || i === 2 ? "left" : "center", vertical: "middle" };
    });
    rowIdx++;
  }

  // Totals row for the day columns.
  const sum = (pick: (r: AttendanceExportRow) => number) => rows.reduce((a, r) => a + pick(r), 0);
  const totalCells = [
    "",
    "",
    "Total",
    "",
    sum((r) => r.presentDays),
    sum((r) => r.absentDays),
    sum((r) => r.paidLeaveUsed),
    sum((r) => r.deductibleAbsentDays),
    sum((r) => r.payableDays),
  ];
  totalCells.forEach((v, i) => {
    const cell = sheet.getCell(rowIdx, i + 1);
    cell.value = v as ExcelJS.CellValue;
    cell.border = THIN_BORDER;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: i === 2 ? "left" : "center", vertical: "middle" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
