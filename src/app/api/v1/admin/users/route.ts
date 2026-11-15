import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { AuthService } from "@/services/AuthService";
import { CreateUserSchema, PaginationSchema } from "@/lib/validations";
import prisma from "@/lib/prisma";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["admin"])) {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const roleFilter = searchParams.get("role");
  const parsedPagination = PaginationSchema.safeParse({
    page: searchParams.get("page") || 1,
    pageSize: searchParams.get("pageSize") || 20,
  });

  const { page, pageSize } = parsedPagination.success
    ? parsedPagination.data
    : { page: 1, pageSize: 20 };

  const whereClause: any = {};
  if (search.trim()) {
    whereClause.OR = [
      { full_name: { contains: search.trim(), mode: "insensitive" } },
      { username: { contains: search.trim(), mode: "insensitive" } },
      { email: { contains: search.trim(), mode: "insensitive" } },
      { student: { student_number: { contains: search.trim() } } },
    ];
  }
  if (roleFilter && ["student", "professor", "higher_education_staff", "admin"].includes(roleFilter)) {
    whereClause.role = roleFilter;
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where: whereClause }),
    prisma.user.findMany({
      where: whereClause,
      include: {
        student: true,
        professor: true,
      },
      orderBy: { user_id: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return apiSuccess({
    total,
    page,
    pageSize,
    users: users.map((u) => ({
      userId: u.user_id,
      username: u.username,
      fullName: u.full_name,
      email: u.email,
      role: u.role,
      isActive: u.is_active,
      baleLinked: !!u.bale_chat_id,
      baleLinkedAt: u.bale_linked_at,
      createdAt: u.created_at,
      student: u.student,
      professor: u.professor,
    })),
  });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError("UNAUTHENTICATED", "ابتدا وارد سیستم شوید", 401);
  }
  if (!hasRole(authUser, ["admin"])) {
    return apiError("FORBIDDEN", "دسترسی مجاز نمی‌باشد", 403);
  }

  try {
    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const result = await AuthService.createAccount(parsed.data as any);
    if (!result.success) {
      return apiError(result.code as any, result.message!, result.status || 400);
    }

    return apiSuccess(result, 201);
  } catch {
    return apiError("INTERNAL_ERROR", "خطا در ایجاد کاربر", 500);
  }
}
