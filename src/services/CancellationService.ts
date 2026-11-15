import prisma from "@/lib/prisma";

export class CancellationService {
  /**
   * Cancels an assigned or confirmed defense session (FR-34, FR-35, Appendix D.6).
   */
  public static async cancel(sessionId: number, userId: number, reason?: string) {
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

    if (session.status !== "assigned" && session.status !== "confirmed") {
      return {
        success: false,
        status: 409,
        code: "RULE_VIOLATION",
        message: "فقط جلسات در وضعیت 'تخصیص‌یافته' یا 'تأییدشده' قابل لغو هستند",
      };
    }

    // Check if user is student of session or one of the assigned professors
    const isStudent = session.student.user_id === userId;
    const professor = await prisma.professor.findUnique({ where: { user_id: userId } });
    const isAssignedProfessor = professor && session.seats.some((s) => s.professor_id === professor.professor_id);

    if (!isStudent && !isAssignedProfessor) {
      return {
        success: false,
        status: 403,
        code: "FORBIDDEN",
        message: "تنها دانشجو یا اساتید داور این جلسه مجاز به لغو آن هستند",
      };
    }

    const updated = await prisma.defenseSession.update({
      where: { session_id: sessionId },
      data: {
        status: "cancelled",
        cancelled_by_user_id: userId,
        cancelled_at: new Date(),
        cancel_reason: reason && reason.trim() !== "" ? reason.trim() : null,
      },
    });

    return {
      success: true,
      session: updated,
      message: "جلسه دفاع لغو شد و تاریخ آزاد گردید",
    };
  }
}
