import prisma from "@/lib/prisma";
import { NotificationService } from "./NotificationService";

export class ResponseService {
  /**
   * Lists defenses assigned to this professor that await an answer (FR-30).
   */
  public static async listPendingForProfessor(professorId: number) {
    return prisma.defenseParticipant.findMany({
      where: {
        professor_id: professorId,
        status: "pending",
        session: {
          status: "assigned", // Only sessions still assigned
        },
      },
      include: {
        session: {
          include: {
            student: {
              include: {
                user: { select: { full_name: true, email: true } },
              },
            },
            slot: {
              include: {
                committee: { select: { name: true } },
                professor: { include: { user: { select: { full_name: true } } } },
              },
            },
            seats: {
              include: {
                professor: { include: { user: { select: { full_name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { session: { scheduled_date: "asc" } },
    });
  }

  /**
   * Records a professor's approval or rejection of an assigned defense (FR-31 to FR-33, Appendix D.5).
   */
  public static async recordDecision(seatId: number, professorId: number, approve: boolean) {
    const seat = await prisma.defenseParticipant.findUnique({
      where: { participant_id: seatId },
      include: { session: { include: { seats: true } } },
    });

    if (!seat) {
      return { success: false, status: 404, code: "NOT_FOUND", message: "کرسی داوری یافت نشد" };
    }

    if (seat.professor_id !== professorId) {
      return {
        success: false,
        status: 403,
        code: "FORBIDDEN",
        message: "شما اجازه ثبت نظر برای این کرسی را ندارید",
      };
    }

    if (seat.session.status !== "assigned") {
      return {
        success: false,
        status: 400,
        code: "RULE_VIOLATION",
        message: "این جلسه دیگر در وضعیت انتظار تایید اساتید نیست",
      };
    }

    if (seat.status !== "pending") {
      return {
        success: false,
        status: 409,
        code: "CONFLICT",
        message: "نظر شما برای این جلسه قبلاً ثبت شده است و قابل تغییر نیست",
      };
    }

    const decisionTime = new Date();
    const newSeatStatus = approve ? "approved" : "rejected";

    if (!approve) {
      // Rejection: session becomes rejected immediately; occurrence freed (Appendix D.5)
      await prisma.$transaction([
        prisma.defenseParticipant.update({
          where: { participant_id: seatId },
          data: { status: "rejected", responded_at: decisionTime },
        }),
        prisma.defenseSession.update({
          where: { session_id: seat.session_id },
          data: { status: "rejected" },
        }),
      ]);

      // Queue outcome Bale messages
      await NotificationService.queueOutcome(seat.session_id);

      return {
        success: true,
        seatStatus: "rejected",
        sessionStatus: "rejected",
        message: "جلسه دفاع با نظر منفی شما رد شد و تاریخ آزاد گردید",
      };
    } else {
      // Approval: check if all seats approved
      await prisma.defenseParticipant.update({
        where: { participant_id: seatId },
        data: { status: "approved", responded_at: decisionTime },
      });

      // Fetch all seats of the session
      const allSeats = await prisma.defenseParticipant.findMany({
        where: { session_id: seat.session_id },
      });

      const allApproved = allSeats.every((s) => s.status === "approved");

      if (allApproved) {
        await prisma.defenseSession.update({
          where: { session_id: seat.session_id },
          data: { status: "confirmed", confirmed_at: decisionTime },
        });

        // Queue outcome Bale messages
        await NotificationService.queueOutcome(seat.session_id);

        return {
          success: true,
          seatStatus: "approved",
          sessionStatus: "confirmed",
          message: "با تأیید شما تمامی داوران جلسه را تایید کردند و جلسه قطعی شد",
        };
      }

      return {
        success: true,
        seatStatus: "approved",
        sessionStatus: "assigned",
        message: "تأیید شما ثبت شد؛ جلسه در انتظار تأیید سایر داوران است",
      };
    }
  }
}
