import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { CancellationService } from "@/services/CancellationService";
import { CancelSessionSchema } from "@/lib/validations";
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

  const sessionId = parseInt(params.id, 10);
  if (isNaN(sessionId)) {
    return apiError(
      "VALIDATION_ERROR",
      isEn ? "Invalid defense session ID" : "شناسه جلسه نامعتبر است",
      422
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CancelSessionSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const result = await CancellationService.cancel(sessionId, authUser.userId, parsed.data.reason);
    if (!result.success) {
      return apiError(result.code as any, result.message!, result.status || 400);
    }

    return apiSuccess({
      message: isEn
        ? "Defense session cancelled and date released"
        : result.message,
      session: result.session,
    });
  } catch {
    return apiError(
      "INTERNAL_ERROR",
      isEn ? "Internal error cancelling defense session" : "خطا در لغو جلسه دفاع",
      500
    );
  }
}
