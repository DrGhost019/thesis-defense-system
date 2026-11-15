import { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { RequestService } from "@/services/RequestService";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }

  const sessionId = parseInt(params.id, 10);
  if (isNaN(sessionId)) {
    return apiError("VALIDATION_ERROR", "شناسه جلسه نامعتبر است", 422);
  }

  const session = await RequestService.getById(sessionId);
  if (!session) {
    return apiError("NOT_FOUND", "درخواست دفاع یافت نشد", 404);
  }

  // Authorization check: student (own), admin, or assigned professor
  const isStudent = session.student.user_id === authUser.userId;
  const isAdmin = authUser.role === "admin";
  const isAssignedProfessor =
    authUser.professorId && session.seats.some((s) => s.professor_id === authUser.professorId);

  if (!isStudent && !isAdmin && !isAssignedProfessor) {
    return apiError("FORBIDDEN", "شما دسترسی به این درخواست را ندارید", 403);
  }

  return apiSuccess({ session });
}
