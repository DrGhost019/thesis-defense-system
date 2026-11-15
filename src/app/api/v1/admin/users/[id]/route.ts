import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["admin"])) {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  const userId = parseInt(params.id, 10);
  if (isNaN(userId)) {
    return apiError("VALIDATION_ERROR", "شناسه کاربر نامعتبر است", 422);
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.is_active !== "boolean") {
    return apiError("VALIDATION_ERROR", "فیلد is_active باید مشخص باشد", 422);
  }

  const user = await prisma.user.findUnique({ where: { user_id: userId } });
  if (!user) {
    return apiError("NOT_FOUND", "کاربر یافت نشد", 404);
  }

  const updated = await prisma.user.update({
    where: { user_id: userId },
    data: { is_active: body.is_active },
  });

  return apiSuccess({
    userId: updated.user_id,
    username: updated.username,
    isActive: updated.is_active,
    message: updated.is_active ? "حساب کاربری فعال شد" : "حساب کاربری غیرفعال شد",
  });
}
