import prisma from "@/lib/prisma";

export class RequestService {
  /**
   * Submits a defense request for a student.
   * Enforces:
   * 1. Profile completeness (degree_level, thesis_title)
   * 2. Exactly one active request (requested, assigned, confirmed)
   */
  public static async submit(studentUserId: number, note?: string) {
    const student = await prisma.student.findUnique({
      where: { user_id: studentUserId },
    });

    if (!student) {
      return {
        success: false,
        status: 403,
        code: "FORBIDDEN",
        message: "فقط دانشجویان مجاز به ثبت درخواست دفاع هستند",
      };
    }

    if (!student.thesis_title || !student.degree_level || student.thesis_title.trim() === "") {
      return {
        success: false,
        status: 400,
        code: "RULE_VIOLATION",
        message: "پروفایل شما ناقص است. لطفاً ابتدا مقطع تحصیلی و عنوان پایان‌نامه را تکمیل کنید",
      };
    }

    // Check one-active-request rule (requested, assigned, or confirmed)
    const activeSession = await prisma.defenseSession.findFirst({
      where: {
        student_id: student.student_id,
        status: { in: ["requested", "assigned", "confirmed"] },
      },
    });

    if (activeSession) {
      return {
        success: false,
        status: 409,
        code: "RULE_VIOLATION",
        message: "شما در حال حاضر یک درخواست فعال (در انتظار، تخصیص‌یافته یا تأیید شده) در سامانه دارید",
      };
    }

    const session = await prisma.defenseSession.create({
      data: {
        student_id: student.student_id,
        note: note && note.trim() !== "" ? note.trim() : null,
        status: "requested",
      },
      include: {
        student: {
          include: {
            user: { select: { full_name: true, email: true } },
          },
        },
      },
    });

    return { success: true, session };
  }

  public static async listMine(studentUserId: number) {
    const student = await prisma.student.findUnique({
      where: { user_id: studentUserId },
    });
    if (!student) return [];

    return prisma.defenseSession.findMany({
      where: { student_id: student.student_id },
      include: {
        slot: {
          include: {
            professor: { include: { user: { select: { full_name: true } } } },
            committee: { select: { name: true } },
          },
        },
        seats: {
          include: {
            professor: { include: { user: { select: { full_name: true } } } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  public static async getById(sessionId: number) {
    return prisma.defenseSession.findUnique({
      where: { session_id: sessionId },
      include: {
        student: {
          include: {
            user: { select: { full_name: true, email: true, username: true } },
          },
        },
        slot: {
          include: {
            professor: { include: { user: { select: { full_name: true } } } },
            committee: {
              include: {
                members: {
                  include: {
                    professor: { include: { user: { select: { full_name: true } } } },
                  },
                },
              },
            },
          },
        },
        seats: {
          include: {
            professor: {
              include: {
                user: { select: { full_name: true, user_id: true } },
              },
            },
          },
        },
        assigned_by: { select: { full_name: true } },
        cancelled_by: { select: { full_name: true } },
      },
    });
  }
}
