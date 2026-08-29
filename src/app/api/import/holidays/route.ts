import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { assertValidExcelFile, parseWorkbookFirstSheet } from "@/lib/excel/parse";
import { validateHolidayRows, ValidatedHolidayRow } from "@/lib/excel/importHolidays";
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

      const existing = await prisma.holiday.findMany({ select: { date: true } });
      const existingDates = new Set(existing.map((h) => h.date.toISOString().slice(0, 10)));

      const result = validateHolidayRows(rows, existingDates);
      return NextResponse.json(result);
    }

    const bodySchema = z.object({ rows: z.array(z.any()), fileName: z.string().optional() });
    const body = bodySchema.parse(await request.json());
    const rows = body.rows as ValidatedHolidayRow[];

    let newRecords = 0;
    let updatedRecords = 0;
    for (const row of rows) {
      const date = new Date(row.date);
      const existing = await prisma.holiday.findUnique({ where: { date } });
      await prisma.holiday.upsert({
        where: { date },
        create: { date, name: row.name, type: row.type, status: "ACTIVE" },
        update: { name: row.name, type: row.type },
      });
      if (existing) updatedRecords++;
      else newRecords++;
    }

    const excelImport = await prisma.excelImport.create({
      data: {
        importType: "HOLIDAY",
        fileName: body.fileName || "holidays.xlsx",
        totalRecords: rows.length,
        newRecords,
        updatedRecords,
        status: "COMPLETED",
        importedById: session.sub,
      },
    });

    await writeAuditLog({ userId: session.sub, action: "EXCEL_IMPORT_HOLIDAYS", entity: "ExcelImport", entityId: excelImport.id, newValue: { newRecords, updatedRecords } });

    return NextResponse.json({ newRecords, updatedRecords, duplicateRecords: 0, errorRecords: 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
