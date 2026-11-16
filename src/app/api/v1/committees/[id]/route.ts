import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { CommitteeService } from "@/services/CommitteeService";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["admin"])) {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  const committeeId = parseInt(params.id, 10);
  if (isNaN(committeeId)) {
    return apiError("VALIDATION_ERROR", "شناسه هیئت داوران نامعتبر است", 422);
  }

  const body = await req.json().catch(() => ({}));
  const result = await CommitteeService.update(committeeId, body);
  if (!result.success) {
    return apiError(result.code as any, result.message!, result.status || 400);
  }

  return apiSuccess(result.committee);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["admin"])) {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  const committeeId = parseInt(params.id, 10);
  if (isNaN(committeeId)) {
    return apiError("VALIDATION_ERROR", "شناسه هیئت داوران نامعتبر است", 422);
  }

  const result = await CommitteeService.delete(committeeId);
  if (!result.success) {
    return apiError(result.code as any, result.message!, result.status || 400);
  }

  return apiSuccess({ message: "هیئت داوران با موفقیت حذف شد" });
}
