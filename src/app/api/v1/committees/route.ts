import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { CommitteeService } from "@/services/CommitteeService";
import { CreateCommitteeSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }

  if (authUser.role === "admin") {
    const committees = await CommitteeService.listAll(false);
    return apiSuccess({ committees });
  } else if (hasRole(authUser, ["professor", "higher_education_staff"])) {
    if (!authUser.professorId) {
      return apiSuccess({ committees: [] });
    }
    const committees = await CommitteeService.listForProfessor(authUser.professorId);
    return apiSuccess({ committees });
  }

  return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["admin"])) {
    return apiError("FORBIDDEN", "تنها مدیر آموزش مجاز به ایجاد هیئت داوران است", 403);
  }

  try {
    const body = await req.json();
    const parsed = CreateCommitteeSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const result = await CommitteeService.create(
      parsed.data.name,
      parsed.data.professor_ids,
      authUser.userId
    );

    if (!result.success) {
      return apiError(result.code as any, result.message!, result.status || 400);
    }

    return apiSuccess(result.committee, 201);
  } catch {
    return apiError("INTERNAL_ERROR", "خطا در ایجاد هیئت داوران", 500);
  }
}
