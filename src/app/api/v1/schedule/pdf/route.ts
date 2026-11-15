import { NextRequest, NextResponse } from "next/server";
import { ScheduleService } from "@/services/ScheduleService";
import { apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weekParam = searchParams.get("week") || undefined;

    const pdfBuffer = await ScheduleService.exportPdf(weekParam);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="defense-schedule-${weekParam || "current"}.pdf"`,
      },
    });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "خطا در تولید فایل PDF جدول هفتگی", 500);
  }
}
