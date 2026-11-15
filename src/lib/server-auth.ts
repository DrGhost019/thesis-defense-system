import { NextRequest } from "next/server";
import { verifyAccessToken, TokenPayload } from "./auth";
import prisma from "./prisma";
import { Role } from "@prisma/client";

export interface AuthenticatedUser extends TokenPayload {
  isActive: boolean;
  studentId?: number;
  professorId?: number;
}

export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get("authorization");
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else {
    // Also check cookie for SSR/web navigation
    token = req.cookies.get("access_token")?.value || "";
  }

  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  // Verify against database to ensure account is active (immediate deactivation rule)
  const user = await prisma.user.findUnique({
    where: { user_id: payload.userId },
    include: {
      student: { select: { student_id: true } },
      professor: { select: { professor_id: true } },
    },
  });

  if (!user || !user.is_active) {
    return null;
  }

  return {
    userId: user.user_id,
    username: user.username,
    role: user.role,
    fullName: user.full_name,
    isActive: user.is_active,
    studentId: user.student?.student_id,
    professorId: user.professor?.professor_id,
  };
}

export function hasRole(user: AuthenticatedUser, allowedRoles: Role[]): boolean {
  // professor and higher_education_staff have identical capabilities (Appendix A.2 & Section 1.4)
  if (allowedRoles.includes("professor") && user.role === "higher_education_staff") {
    return true;
  }
  if (allowedRoles.includes("higher_education_staff") && user.role === "professor") {
    return true;
  }
  return allowedRoles.includes(user.role);
}
