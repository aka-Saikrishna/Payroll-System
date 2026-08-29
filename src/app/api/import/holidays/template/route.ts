import { NextResponse } from "next/server";
import { requireSession, handleApiError } from "@/lib/api-helpers";
import { buildTemplateWorkbook } from "@/lib/excel/template";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireSession();
    const buffer = await buildTemplateWorkbook("Holidays", [
      { header: "Date", example: "2026-08-15", required: true },
      { header: "Holiday Name", example: "Independence Day", required: true },
      { header: "Holiday Type", example: "PUBLIC_HOLIDAY" },
    ]);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="holiday_template.xlsx"',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
