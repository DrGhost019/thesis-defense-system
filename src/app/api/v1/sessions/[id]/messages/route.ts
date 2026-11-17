import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { MessageService } from "@/services/MessageService";
import { CreateMessageSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const isEn =
    req.headers.get("accept-language")?.startsWith("en") ||
    req.nextUrl.searchParams.get("lang") === "en";

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError(
      "UNAUTHENTICATED",
      isEn ? "Please authenticate first" : "ابتدا وارد سیستم شوید",
      401
    );
  }

  const sessionId = parseInt(params.id, 10);
  if (isNaN(sessionId)) {
    return apiError(
      "VALIDATION_ERROR",
      isEn ? "Invalid defense session ID" : "شناسه جلسه نامعتبر است",
      422
    );
  }

  const result = await MessageService.thread(sessionId, authUser.userId, authUser.role);
  if (!result.success) {
    let errMsg = result.message || "";
    if (isEn) {
      if (errMsg.includes("یافت نشد")) {
        errMsg = "Defense session not found";
      } else if (errMsg.includes("دسترسی")) {
        errMsg = "You do not have access to messages in this session";
      } else {
        errMsg = "Failed to load message thread";
      }
    }
    return apiError(result.code as any, errMsg, result.status || 400);
  }

  return apiSuccess({
    messages: result.messages,
    sessionStatus: result.sessionStatus,
    isReadOnly: result.isReadOnly,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const isEn =
    req.headers.get("accept-language")?.startsWith("en") ||
    req.nextUrl.searchParams.get("lang") === "en";

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError(
      "UNAUTHENTICATED",
      isEn ? "Please authenticate first" : "ابتدا وارد سیستم شوید",
      401
    );
  }

  const sessionId = parseInt(params.id, 10);
  if (isNaN(sessionId)) {
    return apiError(
      "VALIDATION_ERROR",
      isEn ? "Invalid defense session ID" : "شناسه جلسه نامعتبر است",
      422
    );
  }

  try {
    const body = await req.json();
    const parsed = CreateMessageSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error, isEn);
    }

    const result = await MessageService.post(sessionId, authUser.userId, parsed.data.content);
    if (!result.success) {
      const rawMsg = typeof result.message === "string" ? result.message : "";
      let errMsg = rawMsg;
      if (isEn) {
        if (rawMsg.includes("یافت نشد")) {
          errMsg = "Defense session not found";
        } else if (rawMsg.includes("تأییدشده") || rawMsg.includes("تأیید شده")) {
          errMsg = "Messaging is only enabled for confirmed defense sessions";
        } else if (rawMsg.includes("اعضای") || rawMsg.includes("تنها")) {
          errMsg = "Only members of this defense session can post messages";
        } else if (rawMsg.includes("خالی")) {
          errMsg = "Message content cannot be empty";
        } else {
          errMsg = "Failed to send message";
        }
      }
      return apiError(result.code as any, errMsg, result.status || 400);
    }

    return apiSuccess({ message: isEn ? "Message posted successfully" : result.message }, 201);
  } catch {
    return apiError(
      "INTERNAL_ERROR",
      isEn ? "Internal error sending message" : "خطا در ارسال پیام",
      500
    );
  }
}
