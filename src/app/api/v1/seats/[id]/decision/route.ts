import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { ResponseService } from "@/services/ResponseService";
import { SeatDecisionSchema } from "@/lib/validations";
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
  if (!hasRole(authUser, ["professor", "higher_education_staff"]) || !authUser.professorId) {
    return apiError(
      "FORBIDDEN",
      isEn ? "Access forbidden" : "دسترسی مجاز نمی‌باشد",
      403
    );
  }

  const seatId = parseInt(params.id, 10);
  if (isNaN(seatId)) {
    return apiError(
      "VALIDATION_ERROR",
      isEn ? "Invalid evaluation seat ID" : "شناسه کرسی داوری نامعتبر است",
      422
    );
  }

  try {
    const body = await req.json();
    const parsed = SeatDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error, isEn);
    }

    const result = await ResponseService.recordDecision(
      seatId,
      authUser.professorId,
      parsed.data.approve
    );

    if (!result.success) {
      let errMsg = result.message || "";
      if (isEn) {
        if (errMsg.includes("یافت نشد")) {
          errMsg = "Evaluation seat not found";
        } else if (errMsg.includes("اجازه ثبت نظر")) {
          errMsg = "You are not authorized to submit a decision for this seat";
        } else if (errMsg.includes("وضعیت انتظار")) {
          errMsg = "This session is no longer awaiting faculty confirmation";
        } else if (errMsg.includes("قبلاً ثبت شده")) {
          errMsg = "Your decision for this session has already been recorded and cannot be changed";
        } else {
          errMsg = "An error occurred while processing the defense decision";
        }
      }
      return apiError(result.code as any, errMsg, result.status || 400);
    }

    let localizedMessage = result.message;
    if (isEn) {
      if (result.sessionStatus === "confirmed") {
        localizedMessage = "With your approval, all committee members confirmed the session and it is now finalized";
      } else if (result.seatStatus === "rejected") {
        localizedMessage = "Defense session was declined with your vote and the date has been released";
      } else if (result.seatStatus === "approved") {
        localizedMessage = "Your approval has been recorded; awaiting other committee members";
      } else {
        localizedMessage = "Your decision has been recorded successfully";
      }
    }

    return apiSuccess({
      message: localizedMessage,
      seatStatus: result.seatStatus,
      sessionStatus: result.sessionStatus,
    });
  } catch {
    return apiError(
      "INTERNAL_ERROR",
      isEn ? "Internal error recording decision" : "خطا در ثبت نظر داور",
      500
    );
  }
}
