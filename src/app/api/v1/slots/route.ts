import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { SlotService } from "@/services/SlotService";
import { CreateSlotSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["professor", "higher_education_staff"])) {
    return apiError("FORBIDDEN", "تنها اساتید می‌توانند بازه حضور تعریف نمایند", 403);
  }

  try {
    const body = await req.json();
    const parsed = CreateSlotSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const result = await SlotService.define(
      parsed.data as any,
      authUser.userId,
      authUser.professorId
    );

    if (!result.success) {
      return apiError(result.code as any, result.message!, result.status || 400);
    }

    return apiSuccess(result.slot, 201);
  } catch {
    return apiError("INTERNAL_ERROR", "خطا در ایجاد بازه زمانی", 500);
  }
}
