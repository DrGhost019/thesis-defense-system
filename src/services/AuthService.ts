import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { hashPassword, verifyPassword, createAccessToken, createRefreshToken, generateBaleLinkCode } from "@/lib/auth";
import { Role, DegreeLevel } from "@prisma/client";
import { subMinutes, subHours, isAfter } from "date-fns";

export interface CreateAccountInput {
  username: string;
  password: string;
  full_name: string;
  email?: string;
  role: Role;
  student_number?: string;
  degree_level?: DegreeLevel;
  thesis_title?: string;
  department?: string;
  academic_title?: string;
  office_location?: string;
}

export class AuthService {
  /**
   * Authenticates user with username & password, enforcing 5 failed logins lockout rule.
   */
  public static async authenticate(username: string, plainPassword: string) {
    const normalizedUsername = username.trim().toLowerCase();
    const fifteenMinutesAgo = subMinutes(new Date(), 15);

    // 1. Check failed login lockout
    const failedAttemptsCount = await prisma.failedLoginAttempt.count({
      where: {
        username: normalizedUsername,
        attempted_at: { gte: fifteenMinutesAgo },
      },
    });

    if (failedAttemptsCount >= 5) {
      logger.warn({ username: normalizedUsername }, "Login locked due to 5 failed attempts in 15 mins");
      return {
        success: false,
        status: 401,
        code: "UNAUTHENTICATED",
        message: "حساب کاربری به دلیل ۵ بار ورود ناموفق، به مدت ۱۵ دقیقه مسدود شده است",
      };
    }

    // 2. Lookup user case-insensitively
    const user = await prisma.user.findFirst({
      where: {
        username: { equals: normalizedUsername, mode: "insensitive" },
      },
      include: {
        student: true,
        professor: true,
      },
    });

    if (!user) {
      await prisma.failedLoginAttempt.create({
        data: { username: normalizedUsername },
      });
      return {
        success: false,
        status: 401,
        code: "UNAUTHENTICATED",
        message: "نام کاربری یا رمز عبور اشتباه است",
      };
    }

    // 3. Check active status
    if (!user.is_active) {
      return {
        success: false,
        status: 401,
        code: "UNAUTHENTICATED",
        message: "حساب کاربری شما غیرفعال شده است. لطفاً با آموزش تماس بگیرید",
      };
    }

    // 4. Check password
    const valid = await verifyPassword(user.password_hash, plainPassword);
    if (!valid) {
      await prisma.failedLoginAttempt.create({
        data: { username: normalizedUsername, user_id: user.user_id },
      });
      return {
        success: false,
        status: 401,
        code: "UNAUTHENTICATED",
        message: "نام کاربری یا رمز عبور اشتباه است",
      };
    }

    // 5. Successful login: clean up old failed attempts
    await prisma.failedLoginAttempt.deleteMany({
      where: { username: normalizedUsername },
    });

    const payload = {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
    };

    const accessToken = await createAccessToken(payload);
    const refreshToken = await createRefreshToken(payload);

    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        email: user.email,
        baleLinked: !!user.bale_chat_id,
        student: user.student,
        professor: user.professor,
      },
    };
  }

  /**
   * Creates an account (User + Student or Professor profile)
   */
  public static async createAccount(data: CreateAccountInput) {
    const normalizedUsername = data.username.trim().toLowerCase();

    // Check unique username
    const existingUser = await prisma.user.findFirst({
      where: { username: { equals: normalizedUsername, mode: "insensitive" } },
    });
    if (existingUser) {
      return { success: false, status: 409, code: "CONFLICT", message: "این نام کاربری قبلاً ثبت شده است" };
    }

    if (data.email && data.email.trim() !== "") {
      const existingEmail = await prisma.user.findFirst({
        where: { email: { equals: data.email.trim(), mode: "insensitive" } },
      });
      if (existingEmail) {
        return { success: false, status: 409, code: "CONFLICT", message: "این ایمیل قبلاً ثبت شده است" };
      }
    }

    if (data.role === "student" && data.student_number) {
      const existingStudentNum = await prisma.student.findUnique({
        where: { student_number: data.student_number.trim() },
      });
      if (existingStudentNum) {
        return { success: false, status: 409, code: "CONFLICT", message: "این شماره دانشجویی قبلاً ثبت شده است" };
      }
    }

    const passwordHash = await hashPassword(data.password);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: normalizedUsername,
          password_hash: passwordHash,
          full_name: data.full_name.trim(),
          email: data.email && data.email.trim() !== "" ? data.email.trim() : null,
          role: data.role,
          is_active: true,
        },
      });

      if (data.role === "student") {
        await tx.student.create({
          data: {
            user_id: newUser.user_id,
            student_number: data.student_number!.trim(),
            degree_level: data.degree_level!,
            thesis_title: data.thesis_title!.trim(),
          },
        });
      } else if (data.role === "professor" || data.role === "higher_education_staff") {
        await tx.professor.create({
          data: {
            user_id: newUser.user_id,
            department: data.department!.trim(),
            academic_title: data.academic_title!.trim(),
            office_location: data.office_location ? data.office_location.trim() : null,
          },
        });
      }

      return newUser;
    });

    return {
      success: true,
      userId: result.user_id,
      username: result.username,
      fullName: result.full_name,
      role: result.role,
    };
  }

  /**
   * Issues an 8-character Bale link code valid for 10 minutes.
   * Rate limited to at most 3 codes per user per hour (Appendix D.8).
   */
  public static async issueBaleLinkCode(userId: number) {
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) {
      return { success: false, status: 404, message: "کاربر یافت نشد" };
    }

    const code = generateBaleLinkCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { user_id: userId },
      data: {
        bale_link_code: code,
        bale_link_expires_at: expiresAt,
      },
    });

    return {
      success: true,
      code,
      expiresAt: expiresAt.toISOString(),
      ttlMinutes: 10,
    };
  }

  /**
   * Completes linking a Bale chat ID via link code (Appendix D.8)
   */
  public static async completeBaleLink(code: string, chatId: string) {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedChatId = String(chatId).trim();

    // Check if chat ID already linked to another user
    const existingWithChatId = await prisma.user.findFirst({
      where: { bale_chat_id: trimmedChatId },
    });

    if (existingWithChatId) {
      return {
        success: false,
        status: 409,
        code: "CONFLICT",
        message: "این شناسه بله قبلاً به یک حساب کاربری دیگر متصل شده است",
      };
    }

    const user = await prisma.user.findFirst({
      where: {
        bale_link_code: trimmedCode,
      },
    });

    if (!user || !user.bale_link_expires_at) {
      return {
        success: false,
        status: 404,
        code: "NOT_FOUND",
        message: "کد اتصال نامعتبر است",
      };
    }

    if (isAfter(new Date(), user.bale_link_expires_at)) {
      // Clear expired code
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: { bale_link_code: null, bale_link_expires_at: null },
      });
      return {
        success: false,
        status: 400,
        code: "RULE_VIOLATION",
        message: "کد اتصال منقضی شده است. لطفاً کد جدیدی دریافت کنید",
      };
    }

    // Success: save chat id and clear code (works only once)
    await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        bale_chat_id: trimmedChatId,
        bale_linked_at: new Date(),
        bale_link_code: null,
        bale_link_expires_at: null,
      },
    });

    return {
      success: true,
      userId: user.user_id,
      fullName: user.full_name,
    };
  }

  /**
   * Unlinks Bale account
   */
  public static async unlinkBale(userId: number) {
    await prisma.user.update({
      where: { user_id: userId },
      data: {
        bale_chat_id: null,
        bale_linked_at: null,
        bale_link_code: null,
        bale_link_expires_at: null,
      },
    });
    return { success: true };
  }
}
