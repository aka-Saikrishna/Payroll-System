import ExcelJS from "exceljs";
import { MONTH_NAMES } from "@/lib/date-utils";

export interface RegisterRow {
  slNo: number;
  employeeCode: string;
  name: string;
  basicSalary: number;
  hra: number;
  conveyance: number;
  totalPay: number;
  daysWorked: number;
  daysAbsent: number;
  totalGrossSalary: number;
  pf: number;
  esi: number;
  pt: number;
  advance: number;
  canteenCharges: number;
  totalDeductions: number;
  otAmount: number;
  netSalaryPaid: number;
  dateOfPayment: string;
}

export interface RegisterHeader {
  companyName: string;
  address: string;
  managerName: string;
  statutoryRef: string;
  year: number;
  month: number;
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const TOTAL_COLUMNS = 20;

/**
 * Builds a workbook replicating the factory's "Payment Register - Register
 * of Wages/Salaries" format (A.P. Payment of Wages Rules 1937, Rule 6A).
 */
export async function buildRegisterOfWagesWorkbook(header: RegisterHeader, rows: RegisterRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${MONTH_NAMES[header.month - 1]} ${header.year}`, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const colWidths = [6, 22, 11, 9, 11, 11, 11, 11, 13, 12, 12, 12, 10, 12, 11, 14, 14, 12, 13, 14];
  sheet.columns = colWidths.map((width) => ({ width }));

  function mergeAndSet(row: number, colStart: number, colEnd: number, value: string, opts?: { bold?: boolean; size?: number }) {
    sheet.mergeCells(row, colStart, row, colEnd);
    const cell = sheet.getCell(row, colStart);
    cell.value = value;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.font = { bold: opts?.bold ?? true, size: opts?.size ?? 10 };
  }

  // Row 1: Title
  mergeAndSet(1, 1, TOTAL_COLUMNS, "PAYMENT REGISTER - REGISTER OF WAGES / SALARIES", { size: 13 });
  // Row 2: Statutory reference
  mergeAndSet(2, 1, TOTAL_COLUMNS, `(${header.statutoryRef})`, { bold: false, size: 9 });
  // Row 3: Factory name/address + month
  sheet.mergeCells(3, 1, 3, 3);
  sheet.getCell(3, 1).value = "Name and Address of the Factory :";
  sheet.getCell(3, 1).font = { bold: true, size: 10 };
  sheet.mergeCells(3, 4, 3, 15);
  sheet.getCell(3, 4).value = `M/s. ${header.companyName}    ${header.address}`;
  sheet.getCell(3, 4).font = { size: 10 };
  sheet.getCell(3, 4).alignment = { wrapText: true, vertical: "middle" };
  sheet.mergeCells(3, 16, 3, 17);
  sheet.getCell(3, 16).value = "For the month of";
  sheet.getCell(3, 16).font = { bold: true, size: 10 };
  sheet.mergeCells(3, 18, 3, 20);
  sheet.getCell(3, 18).value = `${MONTH_NAMES[header.month - 1].toUpperCase()} ${header.year}`;
  sheet.getCell(3, 18).font = { bold: true, size: 10 };
  sheet.getCell(3, 18).alignment = { horizontal: "center" };

  // Row 4: Manager
  sheet.mergeCells(4, 1, 4, 7);
  sheet.getCell(4, 1).value = "Name of the Manager / Person responsible for payment of Salaries :";
  sheet.getCell(4, 1).font = { bold: true, size: 10 };
  sheet.mergeCells(4, 8, 4, 12);
  sheet.getCell(4, 8).value = header.managerName;
  sheet.getCell(4, 8).font = { size: 10 };

  // Row 5: blank spacer
  sheet.getRow(5).height = 6;

  // Rows 6-7: two-row merged header grid
  const headerGroups: { label: string; colStart: number; colEnd: number; subLabels?: string[] }[] = [
    { label: "Sl. No", colStart: 1, colEnd: 1 },
    { label: "Name of the Worker", colStart: 2, colEnd: 2 },
    { label: "Rate of Pay Rs.", colStart: 3, colEnd: 6, subLabels: ["Basic Salary", "HRA", "Conveyance", "Total"] },
    { label: "Earned Salary", colStart: 7, colEnd: 9, subLabels: ["No. of days Worked", "No. of days absent", "Total Gross Salary"] },
    {
      label: "Deductions",
      colStart: 10,
      colEnd: 15,
      subLabels: ["Provident Fund", "ESI Contribution", "Professional Tax", "Advance", "Canteen Charges", "Total"],
    },
    { label: "Over-Time / Late Hours", colStart: 16, colEnd: 16 },
    { label: "Net Salary Paid", colStart: 17, colEnd: 17 },
    { label: "Signature", colStart: 18, colEnd: 18 },
    { label: "Date of Payment", colStart: 19, colEnd: 19 },
    { label: "Remarks", colStart: 20, colEnd: 20 },
  ];

  for (const group of headerGroups) {
    if (group.subLabels) {
      mergeAndSet(6, group.colStart, group.colEnd, group.label);
      group.subLabels.forEach((sub, i) => {
        const col = group.colStart + i;
        sheet.getCell(7, col).value = sub;
        sheet.getCell(7, col).font = { bold: true, size: 9 };
        sheet.getCell(7, col).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });
    } else {
      sheet.mergeCells(6, group.colStart, 7, group.colEnd);
      const cell = sheet.getCell(6, group.colStart);
      cell.value = group.label;
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
  }

  for (let c = 1; c <= TOTAL_COLUMNS; c++) {
    sheet.getCell(6, c).border = THIN_BORDER;
    sheet.getCell(7, c).border = THIN_BORDER;
  }
  sheet.getRow(6).height = 18;
  sheet.getRow(7).height = 30;

  // Data rows. Rupee amounts are rounded to whole rupees for a clean,
  // office-ready printout (payroll figures already carry paisa-level
  // rounding internally, but the register itself should read as whole rupees).
  const round0 = (v: number) => Math.round(v);
  let rowIdx = 8;
  for (const r of rows) {
    const values = [
      r.slNo,
      r.name,
      round0(r.basicSalary),
      round0(r.hra),
      round0(r.conveyance),
      round0(r.totalPay),
      r.daysWorked,
      r.daysAbsent,
      round0(r.totalGrossSalary),
      round0(r.pf),
      round0(r.esi),
      round0(r.pt),
      r.advance ? round0(r.advance) : "",
      r.canteenCharges ? round0(r.canteenCharges) : "",
      round0(r.totalDeductions),
      r.otAmount ? round0(r.otAmount) : "",
      round0(r.netSalaryPaid),
      "",
      r.dateOfPayment,
      "",
    ];
    values.forEach((v, i) => {
      const cell = sheet.getCell(rowIdx, i + 1);
      cell.value = v as ExcelJS.CellValue;
      cell.border = THIN_BORDER;
      cell.font = { size: 9 };
      cell.alignment = { horizontal: i === 1 ? "left" : "center", vertical: "middle" };
      if (typeof v === "number") cell.numFmt = "#,##0";
    });
    rowIdx++;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
