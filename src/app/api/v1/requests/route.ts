import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { RequestService } from "@/services/RequestService";
import { AssignmentService } from "@/services/AssignmentService";
import { CreateRequestSchema, PaginationSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (authUser.role !== "student") {
    return apiError("FORBIDDEN", "تنها دانشجویان مجاز به ثبت درخواست دفاع هستند", 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const result = await RequestService.submit(authUser.userId, parsed.data.note);
    if (!result.success) {
      return apiError(result.code as any, result.message!, result.status || 400);
    }

    return apiSuccess(result.session, 201);
  } catch {
    return apiError("INTERNAL_ERROR", "خطا در ثبت درخواست دفاع", 500);
  }
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["admin"])) {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const parsedPagination = PaginationSchema.safeParse({
    page: searchParams.get("page") || 1,
    pageSize: searchParams.get("pageSize") || 20,
  });
  const { page, pageSize } = parsedPagination.success
    ? parsedPagination.data
    : { page: 1, pageSize: 20 };

  const result = await AssignmentService.listPending(page, pageSize);
  return apiSuccess(result);
}
