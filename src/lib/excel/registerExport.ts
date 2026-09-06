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
  otherAmount: number;
  bonus: number;
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

/** Title size — the factory name and address are printed at this size too. */
const TITLE_SIZE = 13;

const round0 = (v: number) => Math.round(v);
/** Blank instead of a row of zeroes for columns that are usually empty. */
const orBlank = (v: number) => (v ? round0(v) : "");

interface Col {
  label: string;
  width: number;
  get: (r: RegisterRow) => ExcelJS.CellValue;
}
interface Group {
  /** Spanning label on row 6. When subs has one entry sharing this label the
   *  column is merged vertically across rows 6-7 instead. */
  label: string;
  subs: Col[];
}

/**
 * The register's columns depend on the company: VPPL's sheet carries PF/ESI/
 * canteen/OT and no bonus, VPFL's carries an attendance bonus and none of
 * those. Rather than hard-code a layout per company code, a column is included
 * when the period actually has data for it — so a company that never pays a
 * bonus never sees the column, and one that does gets it automatically.
 */
function buildGroups(rows: RegisterRow[]): Group[] {
  const any = (pick: (r: RegisterRow) => number) => rows.some((r) => pick(r) !== 0);
  const hasBonus = any((r) => r.bonus);
  const hasOt = any((r) => r.otAmount);
  const hasOther = any((r) => r.otherAmount);

  const deductions: Col[] = [
    { label: "Provident Fund", width: 12, get: (r) => orBlank(r.pf) },
    { label: "ESI Contribution", width: 12, get: (r) => orBlank(r.esi) },
    { label: "Professional Tax", width: 12, get: (r) => orBlank(r.pt) },
    { label: "Advance", width: 10, get: (r) => orBlank(r.advance) },
    { label: "Canteen Charges", width: 12, get: (r) => orBlank(r.canteenCharges) },
    { label: "Total", width: 11, get: (r) => round0(r.totalDeductions) },
  ];

  const groups: Group[] = [
    { label: "Sl. No", subs: [{ label: "Sl. No", width: 6, get: (r) => r.slNo }] },
    { label: "Name of the Worker", subs: [{ label: "Name of the Worker", width: 22, get: (r) => r.name }] },
    {
      label: "Rate of Pay Rs.",
      subs: [
        { label: "Basic Salary", width: 11, get: (r) => round0(r.basicSalary) },
        { label: "HRA", width: 9, get: (r) => round0(r.hra) },
        { label: "Conveyance", width: 11, get: (r) => round0(r.conveyance) },
        { label: "Total", width: 11, get: (r) => round0(r.totalPay) },
      ],
    },
    {
      label: "Earned Salary",
      subs: [
        { label: "No. of days Worked", width: 11, get: (r) => r.daysWorked },
        { label: "No. of days absent", width: 11, get: (r) => r.daysAbsent },
        { label: "Total Gross Salary", width: 13, get: (r) => round0(r.totalGrossSalary) },
      ],
    },
    { label: "Deductions", subs: deductions },
  ];

  if (hasOt) {
    groups.push({
      label: "Over-Time / Late Hours",
      subs: [{ label: "Over-Time / Late Hours", width: 14, get: (r) => orBlank(r.otAmount) }],
    });
  }
  if (hasBonus) {
    groups.push({
      label: "Attendance Bonus",
      subs: [{ label: "Attendance Bonus", width: 13, get: (r) => orBlank(r.bonus) }],
    });
  }
  if (hasOther) {
    groups.push({
      label: "Other Amount",
      subs: [{ label: "Other Amount", width: 12, get: (r) => orBlank(r.otherAmount) }],
    });
  }

  groups.push(
    { label: "Net Salary Paid", subs: [{ label: "Net Salary Paid", width: 14, get: (r) => round0(r.netSalaryPaid) }] },
    { label: "Signature", subs: [{ label: "Signature", width: 12, get: () => "" }] },
    { label: "Date of Payment", subs: [{ label: "Date of Payment", width: 13, get: (r) => r.dateOfPayment }] },
    { label: "Remarks", subs: [{ label: "Remarks", width: 14, get: () => "" }] }
  );

  return groups;
}

/**
 * Builds a workbook replicating the factory's "Payment Register - Register
 * of Wages/Salaries" format (A.P. Payment of Wages Rules 1937, Rule 6A).
 */
export async function buildRegisterOfWagesWorkbook(header: RegisterHeader, rows: RegisterRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${MONTH_NAMES[header.month - 1]} ${header.year}`, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const groups = buildGroups(rows);
  const cols = groups.flatMap((g) => g.subs);
  const TOTAL_COLUMNS = cols.length;
  sheet.columns = cols.map((c) => ({ width: c.width }));

  function mergeAndSet(row: number, colStart: number, colEnd: number, value: string, opts?: { bold?: boolean; size?: number }) {
    sheet.mergeCells(row, colStart, row, colEnd);
    const cell = sheet.getCell(row, colStart);
    cell.value = value;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.font = { bold: opts?.bold ?? true, size: opts?.size ?? 10 };
  }

  // Row 1: Title
  mergeAndSet(1, 1, TOTAL_COLUMNS, "PAYMENT REGISTER - REGISTER OF WAGES / SALARIES", { size: TITLE_SIZE });
  // Row 2: Statutory reference
  mergeAndSet(2, 1, TOTAL_COLUMNS, `(${header.statutoryRef})`, { bold: false, size: 9 });

  // Row 3: Factory name and address, then the month.
  // Name on the first line and the village/district beneath it, both at the
  // title's size so the header reads as one block.
  const monthColStart = Math.max(TOTAL_COLUMNS - 4, 5);
  sheet.mergeCells(3, 1, 3, 3);
  sheet.getCell(3, 1).value = "Name and Address of the Factory :";
  sheet.getCell(3, 1).font = { bold: true, size: 10 };
  sheet.getCell(3, 1).alignment = { vertical: "middle" };

  sheet.mergeCells(3, 4, 3, monthColStart - 3);
  const factory = sheet.getCell(3, 4);
  factory.value = header.address ? `M/s. ${header.companyName}\n${header.address}` : `M/s. ${header.companyName}`;
  factory.font = { bold: true, size: TITLE_SIZE };
  factory.alignment = { wrapText: true, vertical: "middle" };

  sheet.mergeCells(3, monthColStart - 2, 3, monthColStart - 1);
  sheet.getCell(3, monthColStart - 2).value = "For the month of";
  sheet.getCell(3, monthColStart - 2).font = { bold: true, size: 10 };
  sheet.getCell(3, monthColStart - 2).alignment = { vertical: "middle" };

  sheet.mergeCells(3, monthColStart, 3, TOTAL_COLUMNS);
  sheet.getCell(3, monthColStart).value = `${MONTH_NAMES[header.month - 1].toUpperCase()} ${header.year}`;
  sheet.getCell(3, monthColStart).font = { bold: true, size: 10 };
  sheet.getCell(3, monthColStart).alignment = { horizontal: "center", vertical: "middle" };
  // Two lines at title size need the extra height or the address is clipped.
  sheet.getRow(3).height = 40;

  // Row 4: Manager
  sheet.mergeCells(4, 1, 4, 7);
  sheet.getCell(4, 1).value = "Name of the Manager / Person responsible for payment of Salaries :";
  sheet.getCell(4, 1).font = { bold: true, size: 10 };
  sheet.mergeCells(4, 8, 4, Math.min(13, TOTAL_COLUMNS));
  sheet.getCell(4, 8).value = header.managerName;
  sheet.getCell(4, 8).font = { size: 10 };

  // Row 5: blank spacer
  sheet.getRow(5).height = 6;

  // Rows 6-7: two-row merged header grid
  let col = 1;
  for (const group of groups) {
    const start = col;
    const end = col + group.subs.length - 1;
    const standalone = group.subs.length === 1 && group.subs[0].label === group.label;
    if (standalone) {
      sheet.mergeCells(6, start, 7, end);
      const cell = sheet.getCell(6, start);
      cell.value = group.label;
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    } else {
      mergeAndSet(6, start, end, group.label);
      group.subs.forEach((sub, i) => {
        const c = sheet.getCell(7, start + i);
        c.value = sub.label;
        c.font = { bold: true, size: 9 };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });
    }
    col = end + 1;
  }

  for (let c = 1; c <= TOTAL_COLUMNS; c++) {
    sheet.getCell(6, c).border = THIN_BORDER;
    sheet.getCell(7, c).border = THIN_BORDER;
  }
  sheet.getRow(6).height = 18;
  sheet.getRow(7).height = 30;

  // Data rows. Rupee amounts are whole rupees, matching the payroll engine's
  // round0 so the sheet reconciles line for line.
  let rowIdx = 8;
  for (const r of rows) {
    cols.forEach((c, i) => {
      const cell = sheet.getCell(rowIdx, i + 1);
      const v = c.get(r);
      cell.value = v;
      cell.border = THIN_BORDER;
      cell.font = { size: 9 };
      cell.alignment = { horizontal: c.label === "Name of the Worker" ? "left" : "center", vertical: "middle" };
      if (typeof v === "number") cell.numFmt = "#,##0";
    });
    rowIdx++;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
