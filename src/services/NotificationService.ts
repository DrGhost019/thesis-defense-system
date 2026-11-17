import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { BaleGateway } from "./BaleGateway";
import { NotificationStatus, NotificationType } from "@prisma/client";
import { formatToJalali, getTehranDate, toTehranDateString } from "@/lib/date-utils";
import { addDays, addMinutes } from "date-fns";

/**
 * Appendix F.2:
 * - Outcome retries: after 1, 5, 15, and 60 minutes (5 total attempts), then stays failed.
 * - Reminder retries: hourly until 18:00 Asia/Tehran of the same day, then stays failed.
 */
const OUTCOME_RETRY_DELAYS_MINUTES = [1, 5, 15, 60];
const OUTCOME_MAX_ATTEMPTS = 5;
const REMINDER_CUTOFF_HOUR_TEHRAN = 18;
const BATCH_RATE_LIMIT_MS = 150;

export interface NotificationSessionContext {
  session_id: number;
  status: string;
  scheduled_date: Date | null;
  start_time: string | null;
  end_time: string | null;
  decision_reason: string | null;
  student: {
    user: {
      user_id: number;
      full_name: string;
      bale_chat_id: string | null;
      is_active: boolean;
      preferred_lang: string;
    };
  };
  slot: {
    professor: { user: { full_name: string } } | null;
    committee: { name: string } | null;
  } | null;
  seats: Array<{
    professor: {
      user: {
        user_id: number;
        full_name: string;
        bale_chat_id: string | null;
        is_active: boolean;
        preferred_lang: string;
      };
    };
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTehranHour(date: Date = new Date()): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return parseInt(formatted, 10) % 24;
}

export function computeNextRetryAt(
  type: NotificationType,
  attemptsSoFar: number,
  now: Date = new Date()
): Date | null {
  if (type === "outcome") {
    // attemptsSoFar is 1 after the first failed try -> delay index 0 (1 min), ..., attempt 4 -> index 3 (60 min), attempt 5 -> null
    if (attemptsSoFar >= OUTCOME_MAX_ATTEMPTS) {
      return null;
    }
    const delayMins = OUTCOME_RETRY_DELAYS_MINUTES[attemptsSoFar - 1];
    if (!delayMins) return null;
    return addMinutes(now, delayMins);
  }

  // Reminder: hourly until 18:00 Tehran time of the same day
  const candidate = addMinutes(now, 60);
  const candidateTehranDate = toTehranDateString(candidate);
  const currentTehranDate = toTehranDateString(now);
  const candidateTehranHour = getTehranHour(candidate);

  if (candidateTehranDate !== currentTehranDate || candidateTehranHour > REMINDER_CUTOFF_HOUR_TEHRAN) {
    return null;
  }
  return candidate;
}

export class NotificationService {
  /**
   * Builds exact short, factual message templates per Section 11.4 and Appendix F.2.
   * Never includes thesis title or student note. Includes decline reason only for admin decline.
   */
  public static buildMessageText(
    type: NotificationType,
    session: Pick<
      NotificationSessionContext,
      "status" | "scheduled_date" | "start_time" | "end_time" | "decision_reason" | "student" | "slot"
    >,
    lang: "fa" | "en"
  ): string {
    const isoDate = session.scheduled_date
      ? session.scheduled_date.toISOString().slice(0, 10)
      : "";
    const dateDisplay = isoDate ? (lang === "en" ? isoDate : formatToJalali(isoDate)) : "";
    const startTime = session.start_time || "";
    const endTime = session.end_time || "";
    const ownerName =
      session.slot?.committee?.name ||
      session.slot?.professor?.user.full_name ||
      (lang === "en" ? "Evaluation Committee" : "هیئت داوران");
    const studentName = session.student.user.full_name;

    if (type === "reminder") {
      if (lang === "en") {
        return `Reminder: the thesis defense of ${studentName} is tomorrow, ${dateDisplay}, ${startTime} to ${endTime}.`;
      }
      return `یادآوری: جلسه دفاع ${studentName} فردا، تاریخ ${dateDisplay}، ساعت ${startTime} تا ${endTime} برگزار می‌شود.`;
    }

    // Outcome messages
    if (session.status === "confirmed") {
      if (lang === "en") {
        return `Your thesis defense is confirmed: ${dateDisplay}, ${startTime} to ${endTime}, ${ownerName}.`;
      }
      return `جلسه دفاع پایان‌نامه شما تأیید شد: تاریخ ${dateDisplay}، ساعت ${startTime} تا ${endTime}، ${ownerName}.`;
    }

    if (session.status === "rejected" && session.decision_reason) {
      if (lang === "en") {
        return `Your defense request was declined. Reason: ${session.decision_reason}.`;
      }
      return `درخواست جلسه دفاع شما توسط آموزش رد شد. علت: ${session.decision_reason}.`;
    }

    // Rejected by a professor
    if (lang === "en") {
      return `The defense request could not be confirmed because a professor rejected it. You may submit a new request.`;
    }
    return `درخواست جلسه دفاع به دلیل مخالفت یکی از اساتید تأیید نشد. می‌توانید درخواست جدیدی ثبت کنید.`;
  }

  /**
   * Attempts delivery of a single notification record and updates its status, retry_count, and next_retry_at.
   * Never throws (NFR-12: scheduling is never blocked by Bale failure).
   */
  private static async deliverNotification(
    notificationId: number,
    type: NotificationType,
    currentRetryCount: number,
    chatId: string,
    messageText: string
  ): Promise<"sent" | "failed"> {
    const now = new Date();
    try {
      const res = await BaleGateway.send(chatId, messageText);
      if (res.ok) {
        await prisma.notification.update({
          where: { notification_id: notificationId },
          data: {
            status: "sent",
            sent_at: now,
            last_attempt_at: now,
            next_retry_at: null,
            failure_reason: null,
          },
        });
        return "sent";
      }

      const nextAttempts = currentRetryCount + 1;
      const nextRetryAt = computeNextRetryAt(type, nextAttempts, now);
      await prisma.notification.update({
        where: { notification_id: notificationId },
        data: {
          status: "failed",
          failure_reason: (res.error || "Send failed").slice(0, 200),
          retry_count: nextAttempts,
          last_attempt_at: now,
          next_retry_at: nextRetryAt,
        },
      });
      return "failed";
    } catch (err: any) {
      const nextAttempts = currentRetryCount + 1;
      const nextRetryAt = computeNextRetryAt(type, nextAttempts, now);
      await prisma.notification
        .update({
          where: { notification_id: notificationId },
          data: {
            status: "failed",
            failure_reason: String(err?.message || "Unexpected error").slice(0, 200),
            retry_count: nextAttempts,
            last_attempt_at: now,
            next_retry_at: nextRetryAt,
          },
        })
        .catch(() => {});
      return "failed";
    }
  }

  /**
   * Queues and dispatches outcome notifications for a session (confirmed, rejected, or declined).
   * Respects Appendix F.1 & F.2: unique per (session, recipient, type), skips unlinked/inactive users,
   * never blocks the caller if Bale is unavailable (NFR-12).
   */
  public static async queueOutcome(
    sessionId: number
  ): Promise<{ sent: number; skipped: number; failed: number }> {
    const summary = { sent: 0, skipped: 0, failed: 0 };

    try {
      const session = await prisma.defenseSession.findUnique({
        where: { session_id: sessionId },
        include: {
          student: { include: { user: true } },
          slot: {
            include: {
              professor: { include: { user: true } },
              committee: true,
            },
          },
          seats: {
            include: {
              professor: { include: { user: true } },
            },
          },
        },
      });

      if (!session) return summary;

      const studentUser = session.student.user;
      const professorUsers = session.seats.map((s) => s.professor.user);

      let recipients: typeof professorUsers = [];
      if (session.status === "confirmed") {
        recipients = [studentUser, ...professorUsers];
      } else if (session.status === "rejected") {
        if (session.decision_reason) {
          // Declined by administrator -> student only (Appendix F.1)
          recipients = [studentUser];
        } else {
          // Rejected by a professor -> student and every assigned professor (Appendix F.1)
          recipients = [studentUser, ...professorUsers];
        }
      } else {
        return summary;
      }

      // Deduplicate recipients by user_id
      const uniqueRecipients = Array.from(
        new Map(recipients.map((u) => [u.user_id, u])).values()
      );

      const now = new Date();
      let sentInBatch = 0;

      for (const user of uniqueRecipients) {
        try {
          const hasBale = user.is_active && !!user.bale_chat_id;
          const initialStatus: NotificationStatus = hasBale ? "pending" : "skipped";

          // Duplicate prevention via unique (session_id, recipient_user_id, type)
          const existing = await prisma.notification.findUnique({
            where: {
              session_id_recipient_user_id_type: {
                session_id: sessionId,
                recipient_user_id: user.user_id,
                type: "outcome",
              },
            },
          });

          if (existing) {
            continue;
          }

          const notification = await prisma.notification.create({
            data: {
              session_id: sessionId,
              recipient_user_id: user.user_id,
              type: "outcome",
              scheduled_for: now,
              status: initialStatus,
            },
          });

          if (!hasBale) {
            summary.skipped++;
            continue;
          }

          if (sentInBatch > 0 && !BaleGateway.isStubMode()) {
            await sleep(BATCH_RATE_LIMIT_MS);
          }

          const recipientLang = user.preferred_lang === "en" ? "en" : "fa";
          const text = this.buildMessageText("outcome", session, recipientLang);
          const outcome = await this.deliverNotification(
            notification.notification_id,
            "outcome",
            0,
            user.bale_chat_id!,
            text
          );
          sentInBatch++;

          if (outcome === "sent") {
            summary.sent++;
          } else {
            summary.failed++;
          }
        } catch (err: any) {
          logger.error(
            { err: err?.message, sessionId, recipientId: user.user_id },
            "Error queueing outcome notification"
          );
          summary.failed++;
        }
      }
    } catch (err: any) {
      logger.error({ err: err?.message, sessionId }, "NotificationService.queueOutcome error");
    }

    return summary;
  }

  /**
   * Daily reminder job: runs at 09:00 Asia/Tehran for confirmed sessions scheduled for tomorrow
   * (Decision D-03, Sequence S8, Appendix F.2, Edge Cases #14 & #15).
   */
  public static async runDailyReminders(): Promise<{
    sent: number;
    skipped: number;
    failed: number;
    duplicatesSkipped: number;
  }> {
    const todayTehran = getTehranDate();
    const tomorrowTehran = addDays(todayTehran, 1);
    const tomorrowStr = toTehranDateString(tomorrowTehran);

    logger.info({ tomorrowStr }, "Running daily reminder job");

    const confirmedSessions = await prisma.defenseSession.findMany({
      where: {
        status: "confirmed",
        scheduled_date: new Date(tomorrowStr),
      },
      include: {
        student: { include: { user: true } },
        slot: {
          include: {
            professor: { include: { user: true } },
            committee: true,
          },
        },
        seats: {
          include: {
            professor: { include: { user: true } },
          },
        },
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let duplicatesSkipped = 0;
    let sentInBatch = 0;

    for (const session of confirmedSessions) {
      const recipients = Array.from(
        new Map(
          [session.student.user, ...session.seats.map((s) => s.professor.user)].map((u) => [
            u.user_id,
            u,
          ])
        ).values()
      );

      for (const user of recipients) {
        try {
          const existing = await prisma.notification.findUnique({
            where: {
              session_id_recipient_user_id_type: {
                session_id: session.session_id,
                recipient_user_id: user.user_id,
                type: "reminder",
              },
            },
          });

          if (existing) {
            duplicatesSkipped++;
            continue; // idempotent (T28 / Edge Case #15)
          }

          const hasBale = user.is_active && !!user.bale_chat_id;
          const status: NotificationStatus = hasBale ? "pending" : "skipped";

          const notification = await prisma.notification.create({
            data: {
              session_id: session.session_id,
              recipient_user_id: user.user_id,
              type: "reminder",
              scheduled_for: new Date(),
              status,
            },
          });

          if (!hasBale) {
            skipped++;
            continue;
          }

          if (sentInBatch > 0 && !BaleGateway.isStubMode()) {
            await sleep(BATCH_RATE_LIMIT_MS);
          }

          const recipientLang = user.preferred_lang === "en" ? "en" : "fa";
          const text = this.buildMessageText("reminder", session, recipientLang);
          const result = await this.deliverNotification(
            notification.notification_id,
            "reminder",
            0,
            user.bale_chat_id!,
            text
          );
          sentInBatch++;

          if (result === "sent") {
            sent++;
          } else {
            failed++;
          }
        } catch (err: any) {
          logger.error(
            { err: err?.message, sessionId: session.session_id, userId: user.user_id },
            "Error processing reminder"
          );
          failed++;
        }
      }
    }

    return { sent, skipped, failed, duplicatesSkipped };
  }

  /**
   * Processes any pending notifications and retries due failed notifications according to Appendix F.2:
   * - Outcome retries: 1, 5, 15, 60 min (max 5 total attempts)
   * - Reminder retries: hourly until 18:00 Asia/Tehran of the same day
   * Pass { forceImmediate: true } when triggered manually by an admin from the Reports panel.
   */
  public static async processPendingAndRetries(options?: {
    forceImmediate?: boolean;
  }): Promise<{ sent: number; skipped: number; failed: number }> {
    const forceImmediate = !!options?.forceImmediate;
    const now = new Date();
    const todayTehranStr = toTehranDateString(now);

    const candidates = await prisma.notification.findMany({
      where: forceImmediate
        ? {
            status: { in: ["pending", "failed"] },
          }
        : {
            OR: [
              { status: "pending" },
              {
                status: "failed",
                next_retry_at: { lte: now },
              },
            ],
          },
      include: {
        recipient: true,
        session: {
          include: {
            student: { include: { user: true } },
            slot: {
              include: {
                professor: { include: { user: true } },
                committee: true,
              },
            },
            seats: {
              include: {
                professor: { include: { user: true } },
              },
            },
          },
        },
      },
      orderBy: { scheduled_for: "asc" },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let sentInBatch = 0;

    for (const notif of candidates) {
      if (!notif.recipient.bale_chat_id || !notif.recipient.is_active) {
        await prisma.notification.update({
          where: { notification_id: notif.notification_id },
          data: { status: "skipped", next_retry_at: null },
        });
        skipped++;
        continue;
      }

      // Skip reminders whose defense date is already today or in the past (unless forced)
      if (!forceImmediate && notif.type === "reminder" && notif.session.scheduled_date) {
        const sessionDateStr = notif.session.scheduled_date.toISOString().slice(0, 10);
        if (sessionDateStr <= todayTehranStr) {
          await prisma.notification.update({
            where: { notification_id: notif.notification_id },
            data: { next_retry_at: null },
          });
          continue;
        }
      }

      if (sentInBatch > 0 && !BaleGateway.isStubMode()) {
        await sleep(BATCH_RATE_LIMIT_MS);
      }

      const recipientLang = notif.recipient.preferred_lang === "en" ? "en" : "fa";
      const text = this.buildMessageText(notif.type, notif.session, recipientLang);
      const outcome = await this.deliverNotification(
        notif.notification_id,
        notif.type,
        notif.retry_count,
        notif.recipient.bale_chat_id,
        text
      );
      sentInBatch++;

      if (outcome === "sent") {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, skipped, failed };
  }

  /**
   * Backwards-compatible helper returning the number of retried notifications that succeeded.
   */
  public static async retryFailedNotifications(options?: {
    forceImmediate?: boolean;
  }): Promise<number> {
    const result = await this.processPendingAndRetries(options);
    return result.sent;
  }
}
