import { NextRequest } from "next/server";
import { BaleGateway } from "@/services/BaleGateway";
import { apiSuccess, apiError } from "@/lib/api-response";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
  const isEn =
    req.headers.get("accept-language")?.startsWith("en") ||
    req.cookies.get("thesis_lang")?.value === "en";

  try {
    const secret =
      req.headers.get("x-bale-bot-api-secret-token") ||
      req.headers.get("x-telegram-bot-api-secret-token") ||
      req.nextUrl.searchParams.get("secret");
    const configuredSecret = process.env.BALE_WEBHOOK_SECRET;

    if (configuredSecret && secret !== configuredSecret) {
      logger.warn("Bale webhook: invalid secret token");
      return apiError(
        "FORBIDDEN",
        isEn ? "Invalid secret token" : "توکن محرمانه نامعتبر است",
        403
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError(
        "VALIDATION_ERROR",
        isEn ? "Invalid request body" : "بدنه درخواست نامعتبر است",
        400
      );
    }

    logger.info({ updateId: body.update_id }, "Received Bale webhook update");

    const result = await BaleGateway.handleUpdate(body);

    return apiSuccess({
      status: result.status,
      ...(result.userId ? { user_id: result.userId } : {}),
      ...(result.reason ? { reason: isEn && result.reasonEn ? result.reasonEn : result.reason } : {}),
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "Error processing Bale webhook");
    return apiError(
      "INTERNAL_ERROR",
      isEn ? "Error processing webhook" : "خطا در پردازش وب‌هوک",
      500
    );
  }
}
