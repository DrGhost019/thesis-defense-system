import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { CommitteeService } from "@/services/CommitteeService";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; professorId: string } }
) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["admin"])) {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  const committeeId = parseInt(params.id, 10);
  const professorId = parseInt(params.professorId, 10);

  if (isNaN(committeeId) || isNaN(professorId)) {
    return apiError("VALIDATION_ERROR", "شناسه‌ها نامعتبر هستند", 422);
  }

  const result = await CommitteeService.removeMember(committeeId, professorId);
  if (!result.success) {
    return apiError(result.code as any, result.message!, result.status || 400);
  }

  return apiSuccess({ message: "عضو با موفقیت از هیئت داوران حذف شد" });
}
