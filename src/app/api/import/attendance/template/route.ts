import { NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { buildTemplateWorkbook } from "@/lib/excel/template";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const buffer = await buildTemplateWorkbook("Attendance", [
      { header: "Employee ID", example: "EMP001", required: true },
      { header: "Date", example: "2026-04-01", required: true },
      { header: "Status", example: "PRESENT", required: true },
    ]);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="attendance_template.xlsx"',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
