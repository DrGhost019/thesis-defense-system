import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { AssignmentService } from "@/services/AssignmentService";
import { AssignRequestSchema } from "@/lib/validations";
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
        ? "Only academic administrators can assign defense sessions"
        : "تنها آموزش مجاز به تخصیص زمان دفاع است",
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
    const parsed = AssignRequestSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error, isEn);
    }

    const result = await AssignmentService.assign(
      sessionId,
      parsed.data.slot_id,
      parsed.data.scheduled_date,
      authUser.userId
    );

    if (!result.success) {
      let errMsg = result.message || "";
      if (isEn) {
        if (errMsg.includes("یافت نشد") && errMsg.includes("درخواست")) {
          errMsg = "Defense request not found";
        } else if (errMsg.includes("بازه زمانی یافت نشد")) {
          errMsg = "Time slot not found or has been withdrawn";
        } else if (errMsg.includes("درخواست شده")) {
          errMsg = "Only requests in 'requested' status can be assigned";
        } else if (errMsg.includes("فردا")) {
          errMsg = "Scheduled date must be at least tomorrow";
        } else if (errMsg.includes("مطابقت ندارد")) {
          errMsg = "Selected date does not match the recurrence pattern of this slot";
        } else if (errMsg.includes("رزرو شده")) {
          errMsg = "This time slot is already booked for another session on this date";
        } else if (errMsg.includes("غیرفعال")) {
          errMsg = "The evaluation committee for this slot is deactivated";
        } else if (errMsg.includes("هیچ استاد فعالی")) {
          errMsg = "No active faculty members defined for this slot";
        } else if (errMsg.includes("تداخل زمانی")) {
          errMsg = "Faculty scheduling conflict: one or more professors already have a session at this time";
        } else {
          errMsg = "Failed to assign defense session";
        }
      }
      return apiError(result.code as any, errMsg, result.status || 400);
    }

    return apiSuccess({
      message: isEn
        ? "Defense session assigned successfully and sent to examiners"
        : "جلسه دفاع با موفقیت به بازه انتخابی تخصیص یافت و برای داوران ارسال گردید",
      session: result.session,
    });
  } catch {
    return apiError(
      "INTERNAL_ERROR",
      isEn ? "Internal error assigning defense session" : "خطا در تخصیص بازه دفاع",
      500
    );
  }
}
