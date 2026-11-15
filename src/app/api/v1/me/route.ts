import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }

  const user = await prisma.user.findUnique({
    where: { user_id: authUser.userId },
    include: {
      student: true,
      professor: true,
    },
  });

  if (!user) {
    return apiError("NOT_FOUND", "کاربر یافت نشد", 404);
  }

  return apiSuccess({
    userId: user.user_id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    baleLinked: !!user.bale_chat_id,
    baleLinkedAt: user.bale_linked_at,
    hasLinkCode: !!user.bale_link_code && !!user.bale_link_expires_at && user.bale_link_expires_at > new Date(),
    student: user.student,
    professor: user.professor,
  });
}
