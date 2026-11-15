import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { MessageService } from "@/services/MessageService";
import { CreateMessageSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }

  const sessionId = parseInt(params.id, 10);
  if (isNaN(sessionId)) {
    return apiError("VALIDATION_ERROR", "شناسه جلسه نامعتبر است", 422);
  }

  const result = await MessageService.thread(sessionId, authUser.userId, authUser.role);
  if (!result.success) {
    return apiError(result.code as any, result.message!, result.status || 400);
  }

  return apiSuccess({
    messages: result.messages,
    sessionStatus: result.sessionStatus,
    isReadOnly: result.isReadOnly,
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }

  const sessionId = parseInt(params.id, 10);
  if (isNaN(sessionId)) {
    return apiError("VALIDATION_ERROR", "شناسه جلسه نامعتبر است", 422);
  }

  try {
    const body = await req.json();
    const parsed = CreateMessageSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const result = await MessageService.post(sessionId, authUser.userId, parsed.data.content);
    if (!result.success) {
      return apiError(result.code as any, result.message as string, result.status || 400);
    }

    return apiSuccess({ message: result.message }, 201);
  } catch {
    return apiError("INTERNAL_ERROR", "خطا در ارسال پیام", 500);
  }
}
