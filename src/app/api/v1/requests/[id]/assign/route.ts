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
      return handleZodError(parsed.error);
    }

    const result = await AssignmentService.assign(
      sessionId,
      parsed.data.slot_id,
      parsed.data.scheduled_date,
      authUser.userId
    );

    if (!result.success) {
      return apiError(result.code as any, result.message!, result.status || 400);
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
