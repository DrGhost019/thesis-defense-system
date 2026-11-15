import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { DashboardService } from "@/services/DashboardService";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }

  const data = await DashboardService.getDashboardData(authUser);
  return apiSuccess(data);
}
