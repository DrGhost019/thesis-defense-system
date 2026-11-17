import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { SlotService } from "@/services/SlotService";
import { apiSuccess, apiError } from "@/lib/api-response";

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

  const slotId = parseInt(params.id, 10);
  if (isNaN(slotId)) {
    return apiError(
      "VALIDATION_ERROR",
      isEn ? "Invalid slot ID" : "شناسه بازه نامعتبر است",
      422
    );
  }

  const result = await SlotService.withdraw(slotId, authUser.professorId);
  if (!result.success) {
    let errMsg = result.message || "";
    if (isEn) {
      if (errMsg.includes("یافت نشد")) {
        errMsg = "Availability slot not found";
      } else if (errMsg.includes("اجازه")) {
        errMsg = "You are not authorized to withdraw this slot";
      } else {
        errMsg = "Failed to withdraw availability slot";
      }
    }
    return apiError(result.code as any, errMsg, result.status || 400);
  }

  return apiSuccess({
    message: isEn ? "Availability slot withdrawn successfully" : "بازه با موفقیت لغو شد",
  });
}
