import prisma from "@/lib/prisma";

export class MessageService {
  /**
   * Posts a message in a confirmed session's thread (FR-36, FR-38, Appendix D.7).
   */
  public static async post(sessionId: number, senderUserId: number, content: string) {
    const session = await prisma.defenseSession.findUnique({
      where: { session_id: sessionId },
      include: {
        student: true,
        seats: true,
      },
    });

    if (!session) {
      return { success: false, status: 404, code: "NOT_FOUND", message: "جلسه دفاع یافت نشد" };
    }

    if (session.status !== "confirmed") {
      return {
        success: false,
        status: 409,
        code: "RULE_VIOLATION",
        message: "ارسال پیام تنها در جلسات دفاع قطعی و تأییدشده امکان‌پذیر است",
      };
    }

    // Verify sender is student or assigned professor
    const isStudent = session.student.user_id === senderUserId;
    const professor = await prisma.professor.findUnique({ where: { user_id: senderUserId } });
    const isAssignedProfessor = professor && session.seats.some((s) => s.professor_id === professor.professor_id);

    if (!isStudent && !isAssignedProfessor) {
      return {
        success: false,
        status: 403,
        code: "FORBIDDEN",
        message: "تنها اعضای این جلسه (دانشجو و داوران تخصیص‌یافته) می‌توانند پیام ارسال کنند",
      };
    }

    const message = await prisma.message.create({
      data: {
        session_id: sessionId,
        sender_user_id: senderUserId,
        content: content.trim(),
      },
      include: {
        sender: { select: { full_name: true, role: true, user_id: true } },
      },
    });

    return { success: true, message };
  }

  /**
   * Reads thread messages for a session (FR-37, Appendix D.7).
   */
  public static async thread(sessionId: number, userId: number, role: string) {
    const session = await prisma.defenseSession.findUnique({
      where: { session_id: sessionId },
      include: {
        student: true,
        seats: true,
      },
    });

    if (!session) {
      return { success: false, status: 404, code: "NOT_FOUND", message: "جلسه دفاع یافت نشد" };
    }

    // Admins can read, or student of session, or assigned professors
    const isStudent = session.student.user_id === userId;
    const professor = await prisma.professor.findUnique({ where: { user_id: userId } });
    const isAssignedProfessor = professor && session.seats.some((s) => s.professor_id === professor.professor_id);
    const isAdmin = role === "admin";

    if (!isStudent && !isAssignedProfessor && !isAdmin) {
      return {
        success: false,
        status: 403,
        code: "FORBIDDEN",
        message: "شما دسترسی به پیام‌های این جلسه را ندارید",
      };
    }

    const messages = await prisma.message.findMany({
      where: { session_id: sessionId },
      include: {
        sender: { select: { full_name: true, role: true, user_id: true } },
      },
      orderBy: { sent_at: "asc" },
    });

    return {
      success: true,
      messages,
      sessionStatus: session.status,
      isReadOnly: session.status !== "confirmed",
    };
  }
}
