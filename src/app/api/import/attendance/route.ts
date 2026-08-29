import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { assertValidExcelFile, parseWorkbookFirstSheet } from "@/lib/excel/parse";
import { validateAttendanceRows, ValidatedAttendanceRow } from "@/lib/excel/importAttendance";
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

      const result = validateAttendanceRows(rows, employeeCodeToId);
      return NextResponse.json(result);
    }

    const bodySchema = z.object({ rows: z.array(z.any()), fileName: z.string().optional() });
    const body = bodySchema.parse(await request.json());
    const rows = body.rows as ValidatedAttendanceRow[];

    for (const row of rows) {
      const attendanceDate = new Date(row.attendanceDate);
      await prisma.attendance.upsert({
        where: { employeeId_attendanceDate: { employeeId: row.employeeId, attendanceDate } },
        create: { employeeId: row.employeeId, attendanceDate, status: row.status },
        update: { status: row.status },
      });
    }

    const excelImport = await prisma.excelImport.create({
      data: {
        importType: "ATTENDANCE",
        fileName: body.fileName || "attendance.xlsx",
        totalRecords: rows.length,
        newRecords: rows.length,
        updatedRecords: 0,
        duplicateRecords: 0,
        errorRecords: 0,
        status: "COMPLETED",
        importedById: session.sub,
      },
    });

    await writeAuditLog({
      userId: session.sub,
      action: "EXCEL_IMPORT_ATTENDANCE",
      entity: "ExcelImport",
      entityId: excelImport.id,
      newValue: { count: rows.length },
    });

    return NextResponse.json({ newRecords: rows.length, updatedRecords: 0, duplicateRecords: 0, errorRecords: 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
