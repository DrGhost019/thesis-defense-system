import prisma from "@/lib/prisma";
import {
  isWorkingDay,
  validateSlotTimes,
  expandSlotOccurrences,
  timeIntervalsOverlap,
  toTehranDateString,
  getTehranDate,
} from "@/lib/date-utils";
import { SlotType, RecurrencePattern, Weekday } from "@prisma/client";
import { parseISO, isBefore, differenceInDays } from "date-fns";

export interface DefineSlotInput {
  owner_type: "professor" | "committee";
  committee_id?: number;
  slot_type: SlotType;
  slot_date?: string;
  recurrence_pattern?: RecurrencePattern;
  weekday?: Weekday;
  start_time: string;
  end_time: string;
  valid_from?: string;
  valid_until?: string;
}

export class SlotService {
  public static async define(input: DefineSlotInput, userId: number, professorId?: number) {
    if (!professorId) {
      return { success: false, status: 403, code: "FORBIDDEN", message: "فقط اساتید می‌توانند بازه زمانی تعریف کنند" };
    }

    // 1. Validate Owner
    let assignedProfessorId: number | null = null;
    let assignedCommitteeId: number | null = null;

    if (input.owner_type === "professor") {
      assignedProfessorId = professorId;
    } else {
      if (!input.committee_id) {
        return { success: false, status: 400, code: "VALIDATION_ERROR", message: "شناسه هیئت داوران الزامی است" };
      }
      // Check membership
      const membership = await prisma.committeeMember.findUnique({
        where: {
          committee_id_professor_id: {
            committee_id: input.committee_id,
            professor_id: professorId,
          },
        },
        include: { committee: true },
      });

      if (!membership || !membership.committee.is_active) {
        return {
          success: false,
          status: 403,
          code: "FORBIDDEN",
          message: "شما عضو این هیئت داوران نیستید یا هیئت غیرفعال است",
        };
      }
      assignedCommitteeId = input.committee_id;
    }

    // 2. Validate Times (08:00 to 17:00, 15-min steps, 30m-4h)
    const timeValidation = validateSlotTimes(input.start_time, input.end_time);
    if (!timeValidation.valid) {
      return { success: false, status: 422, code: "VALIDATION_ERROR", message: timeValidation.error! };
    }

    const todayStr = toTehranDateString(getTehranDate());

    // 3. Validate Single vs Recurring
    if (input.slot_type === "single") {
      if (!input.slot_date) {
        return { success: false, status: 422, code: "VALIDATION_ERROR", message: "تاریخ بازه الزامی است" };
      }
      if (!isWorkingDay(input.slot_date)) {
        return {
          success: false,
          status: 422,
          code: "VALIDATION_ERROR",
          message: "روز انتخابی باید یکی از روزهای کاری (شنبه تا چهارشنبه) باشد",
        };
      }
      if (input.slot_date < todayStr) {
        return {
          success: false,
          status: 422,
          code: "VALIDATION_ERROR",
          message: "تاریخ بازه تک‌جلسه نمی‌تواند در گذشته باشد",
        };
      }
    } else {
      // Recurring
      if (!input.recurrence_pattern || !input.valid_from || !input.valid_until) {
        return {
          success: false,
          status: 422,
          code: "VALIDATION_ERROR",
          message: "الگوی تکرار، تاریخ شروع و تاریخ پایان الزامی هستند",
        };
      }
      if (input.valid_until < input.valid_from) {
        return {
          success: false,
          status: 422,
          code: "VALIDATION_ERROR",
          message: "تاریخ پایان بازه اعتبار نمی‌تواند قبل از تاریخ شروع باشد",
        };
      }
      // Max 12 months (366 days)
      const daysDiff = differenceInDays(parseISO(input.valid_until), parseISO(input.valid_from));
      if (daysDiff > 366) {
        return {
          success: false,
          status: 422,
          code: "VALIDATION_ERROR",
          message: "بازه اعتبار تکرار نمی‌تواند بیش از ۱۲ ماه باشد",
        };
      }
      if (input.recurrence_pattern === "weekly" && !input.weekday) {
        return {
          success: false,
          status: 422,
          code: "VALIDATION_ERROR",
          message: "برای الگوی تکرار هفتگی، تعیین روز هفته الزامی است",
        };
      }

      // Check at least one occurrence exists in the validity range
      const occurrences = expandSlotOccurrences(
        {
          slot_type: "recurring",
          recurrence_pattern: input.recurrence_pattern,
          weekday: input.weekday,
          valid_from: input.valid_from,
          valid_until: input.valid_until,
        },
        input.valid_from,
        input.valid_until
      );

      if (occurrences.length === 0) {
        return {
          success: false,
          status: 422,
          code: "VALIDATION_ERROR",
          message: "بازه اعتبار تعیین شده شامل هیچ روز کاری متناسب با الگوی انتخابی نیست",
        };
      }
    }

    // 4. Overlap Check with Same Owner's Other Available Slots
    const existingSlots = await prisma.availabilitySlot.findMany({
      where: {
        status: "available",
        ...(assignedProfessorId ? { professor_id: assignedProfessorId } : { committee_id: assignedCommitteeId }),
      },
    });

    const newOccurrences =
      input.slot_type === "single"
        ? [input.slot_date!]
        : expandSlotOccurrences(
            {
              slot_type: "recurring",
              recurrence_pattern: input.recurrence_pattern,
              weekday: input.weekday,
              valid_from: input.valid_from,
              valid_until: input.valid_until,
            },
            input.valid_from!,
            input.valid_until!
          );

    const newOccurrencesSet = new Set(newOccurrences);

    for (const slot of existingSlots) {
      if (timeIntervalsOverlap(input.start_time, input.end_time, slot.start_time, slot.end_time)) {
        const slotOccurrences = expandSlotOccurrences(
          {
            slot_type: slot.slot_type,
            slot_date: slot.slot_date,
            recurrence_pattern: slot.recurrence_pattern,
            weekday: slot.weekday,
            valid_from: slot.valid_from,
            valid_until: slot.valid_until,
          },
          input.slot_type === "single" ? input.slot_date! : input.valid_from!,
          input.slot_type === "single" ? input.slot_date! : input.valid_until!
        );

        const hasConflict = slotOccurrences.some((d) => newOccurrencesSet.has(d));
        if (hasConflict) {
          return {
            success: false,
            status: 409,
            code: "CONFLICT",
            message: "این بازه زمانی با یکی از بازه‌های از پیش تعریف‌شده همین مالک هم‌پوشانی دارد",
          };
        }
      }
    }

    // 5. Create Slot
    const slot = await prisma.availabilitySlot.create({
      data: {
        professor_id: assignedProfessorId,
        committee_id: assignedCommitteeId,
        created_by_user_id: userId,
        slot_type: input.slot_type,
        slot_date: input.slot_type === "single" ? new Date(input.slot_date!) : null,
        recurrence_pattern: input.slot_type === "recurring" ? input.recurrence_pattern : null,
        weekday: input.slot_type === "recurring" && input.recurrence_pattern === "weekly" ? input.weekday : null,
        start_time: input.start_time,
        end_time: input.end_time,
        valid_from: input.slot_type === "recurring" ? new Date(input.valid_from!) : null,
        valid_until: input.slot_type === "recurring" ? new Date(input.valid_until!) : null,
        status: "available",
      },
      include: {
        professor: { include: { user: { select: { full_name: true } } } },
        committee: { select: { name: true } },
      },
    });

    return { success: true, slot };
  }

  public static async listMine(professorId: number) {
    // Return own slots and committee slots for committees the professor belongs to
    const committeeMemberships = await prisma.committeeMember.findMany({
      where: { professor_id: professorId },
      select: { committee_id: true },
    });
    const committeeIds = committeeMemberships.map((m) => m.committee_id);

    return prisma.availabilitySlot.findMany({
      where: {
        status: "available",
        OR: [{ professor_id: professorId }, { committee_id: { in: committeeIds } }],
      },
      include: {
        professor: { include: { user: { select: { full_name: true } } } },
        committee: { select: { name: true } },
      },
      orderBy: { created_at: "desc" },
    });
  }

  public static async withdraw(slotId: number, professorId: number) {
    const slot = await prisma.availabilitySlot.findUnique({
      where: { slot_id: slotId },
      include: {
        committee: { include: { members: true } },
      },
    });

    if (!slot) {
      return { success: false, status: 404, code: "NOT_FOUND", message: "بازه زمانی یافت نشد" };
    }

    // Check ownership or committee membership
    const isOwner = slot.professor_id === professorId;
    const isCommitteeMember = slot.committee?.members.some((m) => m.professor_id === professorId);

    if (!isOwner && !isCommitteeMember) {
      return {
        success: false,
        status: 403,
        code: "FORBIDDEN",
        message: "شما اجازه لغو یا حذف این بازه زمانی را ندارید",
      };
    }

    await prisma.availabilitySlot.update({
      where: { slot_id: slotId },
      data: { status: "withdrawn" },
    });

    return { success: true };
  }
}
