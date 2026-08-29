import { NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { buildTemplateWorkbook } from "@/lib/excel/template";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const buffer = await buildTemplateWorkbook("Advances", [
      { header: "Employee ID", example: "EMP001", required: true },
      { header: "Date", example: "2026-04-05", required: true },
      { header: "Amount", example: 1000, required: true },
      { header: "Reference", example: "ADV-0001" },
      { header: "Remarks", example: "Emergency advance" },
    ]);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="advance_template.xlsx"',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
