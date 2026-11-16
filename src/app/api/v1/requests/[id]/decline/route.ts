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
      return handleZodError(parsed.error);
    }

    const result = await AssignmentService.decline(sessionId, parsed.data.reason, authUser.userId);
    if (!result.success) {
      return apiError(result.code as any, result.message!, result.status || 400);
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
