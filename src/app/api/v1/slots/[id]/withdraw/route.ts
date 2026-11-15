import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { SlotService } from "@/services/SlotService";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["professor", "higher_education_staff"]) || !authUser.professorId) {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  const slotId = parseInt(params.id, 10);
  if (isNaN(slotId)) {
    return apiError("VALIDATION_ERROR", "شناسه بازه نامعتبر است", 422);
  }

  const result = await SlotService.withdraw(slotId, authUser.professorId);
  if (!result.success) {
    return apiError(result.code as any, result.message!, result.status || 400);
  }

  return apiSuccess({ message: "بازه با موفقیت لغو شد" });
}
