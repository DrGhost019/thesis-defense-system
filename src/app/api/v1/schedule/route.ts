import { NextRequest } from "next/server";
import { ScheduleService } from "@/services/ScheduleService";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weekParam = searchParams.get("week") || undefined;

    const schedule = await ScheduleService.buildWeek(weekParam);
    return apiSuccess(schedule);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "خطا در دریافت جدول زمان‌بندی هفتگی", 500);
  }
}
