import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { RequestService } from "@/services/RequestService";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (authUser.role !== "student") {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  const requests = await RequestService.listMine(authUser.userId);
  return apiSuccess({ requests });
}
