import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { AuthService } from "@/services/AuthService";
import { BaleGateway } from "@/services/BaleGateway";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const isEn = req.headers.get("accept-language")?.startsWith("en");

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError(
      "UNAUTHENTICATED",
      isEn ? "Please authenticate first" : "ابتدا وارد سیستم شوید",
      401
    );
  }

  const user = await prisma.user.findUnique({
    where: { user_id: authUser.userId },
    select: {
      bale_chat_id: true,
      bale_linked_at: true,
      bale_link_code: true,
      bale_link_expires_at: true,
    },
  });

  const hasActiveCode =
    !!user?.bale_link_code &&
    !!user?.bale_link_expires_at &&
    user.bale_link_expires_at > new Date();

  return apiSuccess({
    linked: !!user?.bale_chat_id,
    linkedAt: user?.bale_linked_at,
    hasActiveCode,
    code: hasActiveCode ? user?.bale_link_code : null,
    expiresAt: hasActiveCode ? user?.bale_link_expires_at : null,
    botUsername: BaleGateway.getBotUsername(),
    botUrl: BaleGateway.getBotUrl(),
  });
}

export async function DELETE(req: NextRequest) {
  const isEn = req.headers.get("accept-language")?.startsWith("en");

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError(
      "UNAUTHENTICATED",
      isEn ? "Please authenticate first" : "ابتدا وارد سیستم شوید",
      401
    );
  }

  await AuthService.unlinkBale(authUser.userId);
  return apiSuccess({
    message: isEn
      ? "Bale account unlinked successfully."
      : "اتصال حساب بله با موفقیت لغو شد",
  });
}
