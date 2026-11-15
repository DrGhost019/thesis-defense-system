import { NextRequest } from "next/server";
import { verifyRefreshToken, createAccessToken, createRefreshToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    let token = "";
    const body = await req.json().catch(() => ({}));
    if (body.refreshToken) {
      token = body.refreshToken;
    } else {
      token = req.cookies.get("refresh_token")?.value || "";
    }

    if (!token) {
      return apiError("UNAUTHENTICATED", "توکن رفرش ارائه نشده است", 401);
    }

    const payload = await verifyRefreshToken(token);
    if (!payload) {
      return apiError("UNAUTHENTICATED", "توکن رفرش نامعتبر یا منقضی شده است", 401);
    }

    // Verify user is still active in database
    const user = await prisma.user.findUnique({
      where: { user_id: payload.userId },
    });

    if (!user || !user.is_active) {
      return apiError("UNAUTHENTICATED", "حساب کاربری غیرفعال است", 401);
    }

    const newPayload = {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
    };

    const newAccessToken = await createAccessToken(newPayload);
    const newRefreshToken = await createRefreshToken(newPayload);

    const response = apiSuccess({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

    response.cookies.set("access_token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60,
    });

    response.cookies.set("refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch {
    return apiError("INTERNAL_ERROR", "خطا در تمدید توکن", 500);
  }
}
