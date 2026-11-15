import prisma from "@/lib/prisma";
import {
  expandSlotOccurrences,
  timeIntervalsOverlap,
  toTehranDateString,
  getTehranDate,
} from "@/lib/date-utils";
import { NotificationService } from "./NotificationService";
import { addDays } from "date-fns";

export class AssignmentService {
  /**
   * Lists pending requests waiting for assignment (status = requested), oldest first (Appendix D.4).
   */
  public static async listPending(page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;
    const [total, items] = await Promise.all([
      prisma.defenseSession.count({ where: { status: "requested" } }),
      prisma.defenseSession.findMany({
        where: { status: "requested" },
        include: {
          student: {
            include: {
              user: { select: { full_name: true, email: true, username: true } },
            },
          },
        },
        orderBy: { created_at: "asc" },
        skip,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, items };
  }

  /**
   * Assigns a defense request to a slot and date in a single transaction (Appendix D.4, C.3).
   */
  public static async assign(sessionId: number, slotId: number, scheduledDateStr: string, adminUserId: number) {
    const session = await prisma.defenseSession.findUnique({
      where: { session_id: sessionId },
    });

    if (!session) {
      return { success: false, status: 404, code: "NOT_FOUND", message: "درخواست دفاع یافت نشد" };
    }

    if (session.status !== "requested") {
      return {
        success: false,
        status: 400,
        code: "RULE_VIOLATION",
        message: "فقط درخواست‌های در وضعیت 'درخواست شده' قابل تخصیص هستند",
      };
    }

    // 1. Check Date >= Tomorrow in Asia/Tehran (Decision D-18)
    const todayTehran = getTehranDate();
    const minDateStr = toTehranDateString(addDays(todayTehran, 1));
    if (scheduledDateStr < minDateStr) {
      return {
        success: false,
        status: 422,
        code: "VALIDATION_ERROR",
        message: "تاریخ انتخابی برای دفاع باید حداقل برای فردا یا روزهای بعد باشد",
      };
    }

    // 2. Fetch Slot details
    const slot = await prisma.availabilitySlot.findUnique({
      where: { slot_id: slotId },
      include: {
        professor: { include: { user: true } },
        committee: {
          include: {
            members: {
              include: {
                professor: { include: { user: true } },
              },
            },
          },
        },
      },
    });

    if (!slot || slot.status !== "available") {
      return {
        success: false,
        status: 404,
        code: "NOT_FOUND",
        message: "بازه زمانی یافت نشد یا لغو شده است",
      };
    }

    // 3. Verify scheduledDate is an occurrence of this slot
    const occurrences = expandSlotOccurrences(
      {
        slot_type: slot.slot_type,
        slot_date: slot.slot_date,
        recurrence_pattern: slot.recurrence_pattern,
        weekday: slot.weekday,
        valid_from: slot.valid_from,
        valid_until: slot.valid_until,
      },
      scheduledDateStr,
      scheduledDateStr
    );

    if (!occurrences.includes(scheduledDateStr)) {
      return {
        success: false,
        status: 422,
        code: "VALIDATION_ERROR",
        message: "تاریخ انتخابی با بازه یا الگوی تکرار این بازه زمانی مطابقت ندارد",
      };
    }

    // 4. Occurrence Conflict Check (Appendix C.3)
    const scheduledDateObj = new Date(scheduledDateStr);
    const existingSessionOnOccurrence = await prisma.defenseSession.findFirst({
      where: {
        slot_id: slot.slot_id,
        scheduled_date: scheduledDateObj,
        status: { in: ["assigned", "confirmed"] },
      },
    });

    if (existingSessionOnOccurrence) {
      return {
        success: false,
        status: 409,
        code: "CONFLICT",
        message: "این بازه زمانی در تاریخ انتخابی قبلاً توسط جلسه دیگری رزرو شده است",
      };
    }

    // 5. Professor Overlap Check (Appendix C.3)
    // Gather all professors who will take seats in this session
    let professorsToAssign: { professorId: number; name: string }[] = [];
    if (slot.professor_id && slot.professor) {
      professorsToAssign.push({
        professorId: slot.professor_id,
        name: slot.professor.user.full_name,
      });
    } else if (slot.committee) {
      if (!slot.committee.is_active) {
        return {
          success: false,
          status: 400,
          code: "RULE_VIOLATION",
          message: "هیئت داوران این بازه غیرفعال شده است",
        };
      }
      professorsToAssign = slot.committee.members
        .filter((m) => m.professor.user.is_active)
        .map((m) => ({
          professorId: m.professor_id,
          name: m.professor.user.full_name,
        }));
    }

    if (professorsToAssign.length === 0) {
      return {
        success: false,
        status: 400,
        code: "RULE_VIOLATION",
        message: "هیچ استاد فعالی برای این بازه تعریف نشده است",
      };
    }

    // Check if any of these professors has another assigned or confirmed defense overlapping at this time
    const conflictingProfessors: string[] = [];
    for (const p of professorsToAssign) {
      const activeSeats = await prisma.defenseParticipant.findMany({
        where: {
          professor_id: p.professorId,
          session: {
            scheduled_date: scheduledDateObj,
            status: { in: ["assigned", "confirmed"] },
            session_id: { not: sessionId },
          },
        },
        include: { session: true },
      });

      for (const seat of activeSeats) {
        if (
          seat.session.start_time &&
          seat.session.end_time &&
          timeIntervalsOverlap(slot.start_time, slot.end_time, seat.session.start_time, seat.session.end_time)
        ) {
          conflictingProfessors.push(p.name);
          break;
        }
      }
    }

    if (conflictingProfessors.length > 0) {
      return {
        success: false,
        status: 409,
        code: "CONFLICT",
        message: `تداخل زمانی برای استاد(ان): ${conflictingProfessors.join("، ")}. این استاد در همین ساعت جلسه دیگری دارد`,
      };
    }

    // 6. Execute Assignment in a Single Transaction (Appendix D.4)
    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.defenseSession.update({
        where: { session_id: sessionId },
        data: {
          slot_id: slot.slot_id,
          scheduled_date: scheduledDateObj,
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: "assigned",
          assigned_by_user_id: adminUserId,
          assigned_at: new Date(),
        },
      });

      // Create snapshot seats for all professors
      await tx.defenseParticipant.createMany({
        data: professorsToAssign.map((p) => ({
          session_id: sessionId,
          professor_id: p.professorId,
          status: "pending",
        })),
      });

      return s;
    });

    return { success: true, session: updated };
  }

  /**
   * Declines a defense request with a mandatory reason of at least 5 characters (Appendix D.4).
   */
  public static async decline(sessionId: number, reason: string, adminUserId: number) {
    if (!reason || reason.trim().length < 5) {
      return {
        success: false,
        status: 422,
        code: "VALIDATION_ERROR",
        message: "علت رد درخواست باید حداقل ۵ کاراکتر باشد",
      };
    }

    const session = await prisma.defenseSession.findUnique({
      where: { session_id: sessionId },
    });

    if (!session) {
      return { success: false, status: 404, code: "NOT_FOUND", message: "درخواست دفاع یافت نشد" };
    }

    if (session.status !== "requested") {
      return {
        success: false,
        status: 400,
        code: "RULE_VIOLATION",
        message: "فقط درخواست‌های در وضعیت 'درخواست شده' قابل رد توسط آموزش هستند",
      };
    }

    const updated = await prisma.defenseSession.update({
      where: { session_id: sessionId },
      data: {
        status: "rejected",
        decision_reason: reason.trim(),
        assigned_by_user_id: adminUserId,
        assigned_at: new Date(),
      },
    });

    // Queue Bale outcome message for student
    await NotificationService.queueOutcome(sessionId);

    return { success: true, session: updated };
  }
}
