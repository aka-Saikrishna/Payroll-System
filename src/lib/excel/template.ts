import ExcelJS from "exceljs";

export interface TemplateColumn {
  header: string;
  example: string | number;
  required?: boolean;
}

export async function buildTemplateWorkbook(sheetName: string, columns: TemplateColumn[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.header, width: Math.max(c.header.length + 4, 16) }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF243B53" } };
  });

  const exampleRow: Record<string, string | number> = {};
  columns.forEach((c) => (exampleRow[c.header] = c.example));
  sheet.addRow(exampleRow);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
