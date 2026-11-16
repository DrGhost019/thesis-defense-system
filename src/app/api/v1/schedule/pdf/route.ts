import { NextRequest, NextResponse } from "next/server";
import { ScheduleService } from "@/services/ScheduleService";
import { apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weekParam = searchParams.get("week") || undefined;
    const cookieLang = req.cookies.get("thesis_lang")?.value;
    const langParam = ((searchParams.get("lang") || cookieLang) === "en" ? "en" : "fa") as "fa" | "en";
    const cookieCalendar = req.cookies.get("thesis_calendar")?.value;
    const calendarParam = ((searchParams.get("calendar") || cookieCalendar) === "gregorian" ? "gregorian" : "jalali") as "jalali" | "gregorian";

    const pdfBuffer = await ScheduleService.exportPdf(weekParam, langParam, calendarParam);

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
