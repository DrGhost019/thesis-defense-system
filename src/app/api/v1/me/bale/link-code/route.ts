import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { AuthService } from "@/services/AuthService";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }

  const result = await AuthService.issueBaleLinkCode(authUser.userId);
  if (!result.success) {
    return apiError("RULE_VIOLATION", result.message || "خطا در صدور کد اتصال", result.status || 400);
  }

  return apiSuccess(result);
}
