import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { AuthService } from "@/services/AuthService";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";
import { z } from "zod";

const updateProfilePrefsSchema = z.object({
  preferredLang: z.enum(["fa", "en"]),
});

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
    preferredLang: user.preferred_lang === "en" ? "en" : "fa",
    baleLinked: !!user.bale_chat_id,
    baleLinkedAt: user.bale_linked_at,
    hasLinkCode: !!user.bale_link_code && !!user.bale_link_expires_at && user.bale_link_expires_at > new Date(),
    student: user.student,
    professor: user.professor,
  });
}

export async function PATCH(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateProfilePrefsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "زبان انتخاب‌شده نامعتبر است", 422);
  }

  const result = await AuthService.updatePreferredLang(authUser.userId, parsed.data.preferredLang);
  return apiSuccess(result);
}
