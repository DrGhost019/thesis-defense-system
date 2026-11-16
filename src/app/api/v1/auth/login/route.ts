import { NextRequest } from "next/server";
import { AuthService } from "@/services/AuthService";
import { LoginSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";
import { verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    // Verify Cloudflare Turnstile CAPTCHA
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      undefined;

    const captchaVerification = await verifyTurnstileToken(parsed.data.captcha_token, clientIp);
    if (!captchaVerification.success) {
      return apiError("VALIDATION_ERROR", captchaVerification.message!, 400);
    }

    const result = await AuthService.authenticate(parsed.data.username, parsed.data.password);
    if (!result.success) {
      return apiError(result.code as any, result.message!, result.status || 401);
    }

    const response = apiSuccess({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });

    // Set HTTP-only cookie for web application seamless SSR
    response.cookies.set("access_token", result.accessToken!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60, // 2 hours
    });

    response.cookies.set("refresh_token", result.refreshToken!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "خطای غیرمنتظره در سرور", 500);
  }
}
