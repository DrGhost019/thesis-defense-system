import { NextRequest } from "next/server";
import { AuthService } from "@/services/AuthService";
import { BaleGateway } from "@/services/BaleGateway";
import { apiSuccess, apiError } from "@/lib/api-response";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
  const isEn =
    req.headers.get("accept-language")?.includes("en") ||
    req.cookies.get("thesis_lang")?.value === "en";

  try {
    const secret = req.headers.get("x-bale-bot-api-secret-token") || req.nextUrl.searchParams.get("secret");
    const configuredSecret = process.env.BALE_WEBHOOK_SECRET;

    if (configuredSecret && secret !== configuredSecret) {
      logger.warn("Bale webhook: invalid secret token");
      return apiError("FORBIDDEN", isEn ? "Invalid secret token" : "توکن محرمانه نامعتبر است", 403);
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("VALIDATION_ERROR", isEn ? "Invalid request body" : "بدنه درخواست نامعتبر است", 400);
    }

    logger.info({ body }, "Received Bale webhook update");

    // Standard Telegram/Bale update format: { update_id, message: { chat: { id }, text } }
    const message = body.message || body.channel_post;
    if (!message || !message.text) {
      return apiSuccess({ status: "ignored_no_message" });
    }

    const chatId = String(message.chat?.id || message.from?.id || "");
    const rawText = message.text.trim();

    // Check if message is a link code or command like /start CODE
    let code = rawText;
    if (rawText.startsWith("/start ")) {
      code = rawText.substring(7).trim();
    }

    if (!code || !chatId) {
      return apiSuccess({ status: "ignored_empty" });
    }

    const linkResult = await AuthService.completeBaleLink(code, chatId);
    if (linkResult.success) {
      await BaleGateway.send(
        chatId,
        `سلام ${linkResult.fullName} عزیز؛\nحساب پیام‌رسان بله شما با موفقیت به سامانه دفاع پایان‌نامه متصل شد. از این پس اعلان‌های وضعیت جلسه و یادآوری‌ها برای شما ارسال خواهد شد.`
      );
      return apiSuccess({ status: "linked", user_id: linkResult.userId });
    } else {
      await BaleGateway.send(
        chatId,
        `خطا در اتصال حساب کاربری:\n${linkResult.message || "کد اتصال نامعتبر یا منقضی شده است."}`
      );
      return apiSuccess({ status: "link_failed", reason: linkResult.message });
    }
  } catch (err: any) {
    logger.error({ err: err.message }, "Error processing Bale webhook");
    return apiError("INTERNAL_ERROR", isEn ? "Error processing webhook" : "خطا در پردازش وب‌هوک", 500);
  }
}
