import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, handleApiError } from "@/lib/api-helpers";
import { assertValidExcelFile, parseWorkbookFirstSheet } from "@/lib/excel/parse";
import { validateEmployeeRows, ValidatedEmployeeRow } from "@/lib/excel/importEmployees";
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

      const existing = await prisma.employee.findMany({ select: { employeeCode: true } });
      const existingCodes = new Set(existing.map((e) => e.employeeCode));

      const result = validateEmployeeRows(rows, existingCodes);
      return NextResponse.json(result);
    }

    const bodySchema = z.object({ rows: z.array(z.any()), fileName: z.string().optional() });
    const body = bodySchema.parse(await request.json());
    const rows = body.rows as ValidatedEmployeeRow[];

    let newRecords = 0;
    let updatedRecords = 0;

    for (const row of rows) {
      await prisma.employee.upsert({
        where: { employeeCode: row.employeeCode },
        create: {
          employeeCode: row.employeeCode,
          name: row.name,
          mobile: row.mobile || null,
          email: row.email || null,
          department: row.department || null,
          designation: row.designation || null,
          joiningDate: row.joiningDate ? new Date(row.joiningDate) : null,
          status: "ACTIVE",
          salaryConfig: {
            create: {
              basicSalary: row.basicSalary,
              hra: row.hra,
              conveyance: row.conveyance,
              monthlySalary: row.monthlySalary,
              pfApplicable: row.pfApplicable,
              esiApplicable: row.esiApplicable,
              ptApplicable: row.ptApplicable,
              rttApplicable: row.rttApplicable,
              paidLeaveApplicable: row.paidLeaveApplicable,
            },
          },
        },
        update: {
          name: row.name,
          mobile: row.mobile || null,
          email: row.email || null,
          department: row.department || null,
          designation: row.designation || null,
          joiningDate: row.joiningDate ? new Date(row.joiningDate) : null,
          salaryConfig: {
            upsert: {
              create: {
                basicSalary: row.basicSalary,
                hra: row.hra,
                conveyance: row.conveyance,
                monthlySalary: row.monthlySalary,
                pfApplicable: row.pfApplicable,
                esiApplicable: row.esiApplicable,
                ptApplicable: row.ptApplicable,
                rttApplicable: row.rttApplicable,
                paidLeaveApplicable: row.paidLeaveApplicable,
              },
              update: {
                basicSalary: row.basicSalary,
                hra: row.hra,
                conveyance: row.conveyance,
                monthlySalary: row.monthlySalary,
                pfApplicable: row.pfApplicable,
                esiApplicable: row.esiApplicable,
                ptApplicable: row.ptApplicable,
                rttApplicable: row.rttApplicable,
                paidLeaveApplicable: row.paidLeaveApplicable,
              },
            },
          },
        },
      });
      if (row.isUpdate) updatedRecords++;
      else newRecords++;
    }

    const excelImport = await prisma.excelImport.create({
      data: {
        importType: "EMPLOYEE",
        fileName: body.fileName || "employees.xlsx",
        totalRecords: rows.length,
        newRecords,
        updatedRecords,
        duplicateRecords: 0,
        errorRecords: 0,
        status: "COMPLETED",
        importedById: session.sub,
      },
    });

    await writeAuditLog({
      userId: session.sub,
      action: "EXCEL_IMPORT_EMPLOYEES",
      entity: "ExcelImport",
      entityId: excelImport.id,
      newValue: { newRecords, updatedRecords },
    });

    return NextResponse.json({ newRecords, updatedRecords, duplicateRecords: 0, errorRecords: 0 });
  } catch (error) {
    return handleApiError(error);
  }
}
