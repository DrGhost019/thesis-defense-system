import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { AuthService } from "@/services/AuthService";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const isEn = req.headers.get("accept-language")?.startsWith("en");

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError(
      "UNAUTHENTICATED",
      isEn ? "Please authenticate first" : "ابتدا وارد سیستم شوید",
      401
    );
  }

  const result = await AuthService.issueBaleLinkCode(authUser.userId);
  if (!result.success) {
    const errorCode = result.code || "RULE_VIOLATION";
    const msg = isEn
      ? result.messageEn || "Failed to generate Bale linking code."
      : result.message || "خطا در صدور کد اتصال";
    return apiError(errorCode as any, msg, result.status || 400);
  }

  return apiSuccess(result);
}
