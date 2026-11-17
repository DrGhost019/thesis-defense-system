import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { AssignmentService } from "@/services/AssignmentService";
import { DeclineRequestSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const isEn =
    req.headers.get("accept-language")?.startsWith("en") ||
    req.nextUrl.searchParams.get("lang") === "en";

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
      isEn
        ? "Only academic administrators can decline defense requests"
        : "تنها آموزش مجاز به رد درخواست دفاع است",
      403
    );
  }

  const sessionId = parseInt(params.id, 10);
  if (isNaN(sessionId)) {
    return apiError(
      "VALIDATION_ERROR",
      isEn ? "Invalid defense session ID" : "شناسه جلسه نامعتبر است",
      422
    );
  }

  try {
    const body = await req.json();
    const parsed = DeclineRequestSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error, isEn);
    }

    const result = await AssignmentService.decline(sessionId, parsed.data.reason, authUser.userId);
    if (!result.success) {
      let errMsg = result.message || "";
      if (isEn) {
        if (errMsg.includes("یافت نشد")) {
          errMsg = "Defense request not found";
        } else if (errMsg.includes("۵ کاراکتر")) {
          errMsg = "Decline reason must be at least 5 characters";
        } else if (errMsg.includes("درخواست شده")) {
          errMsg = "Only requests in 'requested' status can be declined";
        } else {
          errMsg = "Failed to decline defense request";
        }
      }
      return apiError(result.code as any, errMsg, result.status || 400);
    }

    return apiSuccess({
      message: isEn
        ? "Defense request declined and student notified"
        : "درخواست دفاع با موفقیت رد شد و به دانشجو اطلاع‌رسانی گردید",
      session: result.session,
    });
  } catch {
    return apiError(
      "INTERNAL_ERROR",
      isEn ? "Internal error declining defense request" : "خطا در رد درخواست دفاع",
      500
    );
  }
}
