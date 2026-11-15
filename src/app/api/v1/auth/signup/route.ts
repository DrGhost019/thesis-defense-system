import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-response";

export async function POST(_req: NextRequest) {
  return apiError(
    "FORBIDDEN",
    "ثبت‌نام مستقیم غیرفعال است. کلیه کاربران باید با اطلاعات حساب دانشگاهی وارد شوند.",
    403
  );
}
