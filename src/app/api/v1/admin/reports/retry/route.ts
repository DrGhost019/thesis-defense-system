import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { NotificationService } from "@/services/NotificationService";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const isEn = req.headers.get("accept-language")?.startsWith("en");

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError(
      "UNAUTHENTICATED",
      isEn ? "Please authenticate first" : "ابتدا وارد سیستم شوید",
      401
    );
  }

  if (!hasRole(authUser, ["admin"])) {
    return apiError(
      "FORBIDDEN",
      isEn ? "Access forbidden" : "دسترسی مجاز نمی‌باشد",
      403
    );
  }

  const result = await NotificationService.processPendingAndRetries({ forceImmediate: true });

  return apiSuccess({
    ...result,
    message: isEn
      ? `Retry completed: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped.`
      : `تلاش مجدد انجام شد: ${result.sent} ارسال شد، ${result.failed} ناموفق، ${result.skipped} رد شد.`,
  });
}
