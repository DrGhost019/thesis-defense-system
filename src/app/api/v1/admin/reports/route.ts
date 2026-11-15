import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["admin"])) {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  const [failedNotifications, unlinkedUsers] = await Promise.all([
    prisma.notification.findMany({
      where: { status: "failed" },
      include: {
        recipient: { select: { full_name: true, username: true, role: true } },
        session: {
          select: {
            session_id: true,
            scheduled_date: true,
            start_time: true,
            end_time: true,
          },
        },
      },
      orderBy: { scheduled_for: "desc" },
    }),
    prisma.user.findMany({
      where: { bale_chat_id: null, is_active: true },
      select: {
        user_id: true,
        username: true,
        full_name: true,
        role: true,
        email: true,
        created_at: true,
      },
      orderBy: { user_id: "desc" },
    }),
  ]);

  return apiSuccess({
    failedNotifications,
    unlinkedUsers,
  });
}
