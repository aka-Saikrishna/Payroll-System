import { NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { buildTemplateWorkbook } from "@/lib/excel/template";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const buffer = await buildTemplateWorkbook("Employees", [
      { header: "Employee ID", example: "EMP005", required: true },
      { header: "Employee Name", example: "Anita Rao", required: true },
      { header: "Mobile", example: "9876543210" },
      { header: "Email", example: "anita@example.com" },
      { header: "Department", example: "Production" },
      { header: "Designation", example: "Operator" },
      { header: "Joining Date", example: "2026-01-15" },
      { header: "Basic Salary", example: 20000, required: true },
      { header: "HRA", example: 0 },
      { header: "Conveyance", example: 0 },
      { header: "PF Applicable", example: "TRUE" },
      { header: "ESI Applicable", example: "FALSE" },
      { header: "PT Applicable", example: "TRUE" },
      { header: "RTT Applicable", example: "FALSE" },
      { header: "Paid Leave Applicable", example: "FALSE" },
    ]);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="employee_template.xlsx"',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
