import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { assertValidExcelFile, parseWorkbookFirstSheet } from "@/lib/excel/parse";
import { validateAdvanceRows, ValidatedAdvanceRow } from "@/lib/excel/importAdvances";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "PAYROLL_MANAGER"]);
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

      assertValidExcelFile(file.name, file.size);
      const buffer = Buffer.from(await file.arrayBuffer());
      const { rows } = await parseWorkbookFirstSheet(buffer);

      const employees = await prisma.employee.findMany({ select: { id: true, employeeCode: true } });
      const employeeCodeToId = new Map(employees.map((e) => [e.employeeCode, e.id]));

      const result = validateAdvanceRows(rows, employeeCodeToId);
      return NextResponse.json(result);
    }

    const bodySchema = z.object({ rows: z.array(z.any()), fileName: z.string().optional() });
    const body = bodySchema.parse(await request.json());
    const rows = body.rows as ValidatedAdvanceRow[];

    for (const row of rows) {
      await prisma.salaryAdvance.create({
        data: {
          employeeId: row.employeeId,
          advanceDate: new Date(row.advanceDate),
          amount: row.amount,
          reference: row.reference || null,
          remarks: row.remarks || null,
        },
      });
    }

    const excelImport = await prisma.excelImport.create({
      data: {
        importType: "ADVANCE",
        fileName: body.fileName || "advances.xlsx",
        totalRecords: rows.length,
        newRecords: rows.length,
        status: "COMPLETED",
        importedById: session.sub,
      },
    });

    await writeAuditLog({ userId: session.sub, action: "EXCEL_IMPORT_ADVANCES", entity: "ExcelImport", entityId: excelImport.id, newValue: { count: rows.length } });

    return NextResponse.json({ newRecords: rows.length, updatedRecords: 0, duplicateRecords: 0, errorRecords: 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
