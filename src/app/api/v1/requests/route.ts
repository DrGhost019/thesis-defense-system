import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { RequestService } from "@/services/RequestService";
import { AssignmentService } from "@/services/AssignmentService";
import { CreateRequestSchema, PaginationSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
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
  if (authUser.role !== "student") {
    return apiError(
      "FORBIDDEN",
      isEn
        ? "Only students are authorized to submit defense requests"
        : "تنها دانشجویان مجاز به ثبت درخواست دفاع هستند",
      403
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error, isEn);
    }

    const result = await RequestService.submit(authUser.userId, parsed.data.note);
    if (!result.success) {
      let errMsg = result.message || "";
      if (isEn) {
        if (errMsg.includes("فعال")) {
          errMsg = "You already have an active defense request in the system";
        } else if (errMsg.includes("ناقص")) {
          errMsg = "Your profile is incomplete. Please complete your degree level and thesis title first";
        } else {
          errMsg = "Failed to submit defense request";
        }
      }
      return apiError(result.code as any, errMsg, result.status || 400);
    }

    return apiSuccess(result.session, 201);
  } catch {
    return apiError(
      "INTERNAL_ERROR",
      isEn ? "Internal error submitting defense request" : "خطا در ثبت درخواست دفاع",
      500
    );
  }
}

export async function GET(req: NextRequest) {
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
  if (!hasRole(authUser, ["admin"])) {
    return apiError(
      "FORBIDDEN",
      isEn ? "Access forbidden" : "دسترسی مجاز نمی‌باشد",
      403
    );
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
