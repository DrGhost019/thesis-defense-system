import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { ResponseService } from "@/services/ResponseService";
import { SeatDecisionSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["professor", "higher_education_staff"]) || !authUser.professorId) {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  const seatId = parseInt(params.id, 10);
  if (isNaN(seatId)) {
    return apiError("VALIDATION_ERROR", "شناسه کرسی داوری نامعتبر است", 422);
  }

  try {
    const body = await req.json();
    const parsed = SeatDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const result = await ResponseService.recordDecision(
      seatId,
      authUser.professorId,
      parsed.data.approve
    );

    if (!result.success) {
      return apiError(result.code as any, result.message!, result.status || 400);
    }

    return apiSuccess({
      message: result.message,
      seatStatus: result.seatStatus,
      sessionStatus: result.sessionStatus,
    });
  } catch {
    return apiError("INTERNAL_ERROR", "خطا در ثبت نظر داور", 500);
  }
}
