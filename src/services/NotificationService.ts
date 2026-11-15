import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { BaleGateway } from "./BaleGateway";
import { NotificationType, NotificationStatus } from "@prisma/client";
import { formatToJalali, getTehranDate, toTehranDateString } from "@/lib/date-utils";
import { addDays } from "date-fns";

export class NotificationService {
  /**
   * Queues and dispatches outcome notifications for a session (confirmed, rejected, or declined).
   */
  public static async queueOutcome(sessionId: number): Promise<void> {
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

    if (!session) return;

    const studentUser = session.student.user;
    const professorUsers = session.seats.map((s) => s.professor.user);
    const dateFormatted = session.scheduled_date
      ? formatToJalali(session.scheduled_date.toISOString().slice(0, 10))
      : "";
    const ownerName =
      session.slot?.committee?.name ||
      session.slot?.professor?.user.full_name ||
      "هیئت داوران";

    let messageText = "";
    let recipients: { userId: number; baleChatId: string | null; isActive: boolean }[] = [];

    if (session.status === "confirmed") {
      messageText = `جلسه دفاع شما تأیید شد: تاریخ ${dateFormatted} از ساعت ${session.start_time} تا ${session.end_time} (${ownerName}).`;
      recipients = [studentUser, ...professorUsers].map((u) => ({
        userId: u.user_id,
        baleChatId: u.bale_chat_id,
        isActive: u.is_active,
      }));
    } else if (session.status === "rejected") {
      if (session.decision_reason) {
        // Declined by admin
        messageText = `درخواست جلسه دفاع شما توسط آموزش رد شد. علت: ${session.decision_reason}`;
        recipients = [{ userId: studentUser.user_id, baleChatId: studentUser.bale_chat_id, isActive: studentUser.is_active }];
      } else {
        // Rejected by a professor
        messageText = `درخواست جلسه دفاع شما تأیید نشد زیرا یکی از اساتید آن را رد کرد. می‌توانید درخواست جدیدی ثبت کنید.`;
        recipients = [studentUser, ...professorUsers].map((u) => ({
          userId: u.user_id,
          baleChatId: u.bale_chat_id,
          isActive: u.is_active,
        }));
      }
    } else {
      return;
    }

    const now = new Date();
    for (const r of recipients) {
      try {
        const isSkipped = !r.isActive || !r.baleChatId;
        const initialStatus: NotificationStatus = isSkipped ? "skipped" : "pending";

        // Upsert to handle unique constraint (session_id, recipient_user_id, type)
        const notification = await prisma.notification.upsert({
          where: {
            session_id_recipient_user_id_type: {
              session_id: sessionId,
              recipient_user_id: r.userId,
              type: "outcome",
            },
          },
          update: {},
          create: {
            session_id: sessionId,
            recipient_user_id: r.userId,
            type: "outcome",
            scheduled_for: now,
            status: initialStatus,
          },
        });

        if (initialStatus === "pending" && r.baleChatId) {
          const res = await BaleGateway.send(r.baleChatId, messageText);
          if (res.ok) {
            await prisma.notification.update({
              where: { notification_id: notification.notification_id },
              data: { status: "sent", sent_at: new Date() },
            });
          } else {
            await prisma.notification.update({
              where: { notification_id: notification.notification_id },
              data: { status: "failed", failure_reason: res.error || "Send failed", retry_count: { increment: 1 } },
            });
          }
        }
      } catch (err: any) {
        logger.error({ err: err.message, recipientId: r.userId }, "Error queueing outcome notification");
      }
    }
  }

  /**
   * Daily reminder job: runs at 09:00 Tehran time for confirmed sessions scheduled for tomorrow.
   */
  public static async runDailyReminders(): Promise<{ sent: number; skipped: number; failed: number }> {
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

    for (const session of confirmedSessions) {
      const studentName = session.student.user.full_name;
      const dateFormatted = formatToJalali(tomorrowStr);
      const messageText = `یادآوری: جلسه دفاع ${studentName} فردا ${dateFormatted} از ساعت ${session.start_time} تا ${session.end_time} برگزار خواهد شد.`;

      const recipients = [session.student.user, ...session.seats.map((s) => s.professor.user)];

      for (const user of recipients) {
        try {
          const hasBale = user.is_active && !!user.bale_chat_id;
          const status: NotificationStatus = hasBale ? "pending" : "skipped";

          // Check if already created
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
            continue; // idempotent, skip duplicate
          }

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

          const res = await BaleGateway.send(user.bale_chat_id!, messageText);
          if (res.ok) {
            await prisma.notification.update({
              where: { notification_id: notification.notification_id },
              data: { status: "sent", sent_at: new Date() },
            });
            sent++;
          } else {
            await prisma.notification.update({
              where: { notification_id: notification.notification_id },
              data: { status: "failed", failure_reason: res.error || "Delivery failed", retry_count: { increment: 1 } },
            });
            failed++;
          }
        } catch (err: any) {
          logger.error({ err: err.message, userId: user.user_id }, "Error processing reminder");
          failed++;
        }
      }
    }

    return { sent, skipped, failed };
  }

  /**
   * Retries failed notifications (Appendix F.2: outcome retried after 1, 5, 15, 60 mins; up to 5 attempts)
   */
  public static async retryFailedNotifications(): Promise<number> {
    const failedList = await prisma.notification.findMany({
      where: {
        status: "failed",
        retry_count: { lt: 5 },
      },
      include: {
        recipient: true,
        session: {
          include: {
            student: { include: { user: true } },
          },
        },
      },
    });

    let successCount = 0;
    for (const notif of failedList) {
      if (!notif.recipient.bale_chat_id || !notif.recipient.is_active) {
        await prisma.notification.update({
          where: { notification_id: notif.notification_id },
          data: { status: "skipped" },
        });
        continue;
      }

      // Reconstruct text
      const dateFormatted = notif.session.scheduled_date
        ? formatToJalali(notif.session.scheduled_date.toISOString().slice(0, 10))
        : "";
      let text = "";
      if (notif.type === "outcome") {
        if (notif.session.status === "confirmed") {
          text = `جلسه دفاع شما تأیید شد: تاریخ ${dateFormatted} از ساعت ${notif.session.start_time} تا ${notif.session.end_time}.`;
        } else {
          text = `نتیجه درخواست دفاع: وضعیت جلسه ${notif.session.status} شد.`;
        }
      } else {
        text = `یادآوری: جلسه دفاع فردا ${dateFormatted} ساعت ${notif.session.start_time} برگزار می‌شود.`;
      }

      const res = await BaleGateway.send(notif.recipient.bale_chat_id, text);
      if (res.ok) {
        await prisma.notification.update({
          where: { notification_id: notif.notification_id },
          data: { status: "sent", sent_at: new Date() },
        });
        successCount++;
      } else {
        await prisma.notification.update({
          where: { notification_id: notif.notification_id },
          data: { failure_reason: res.error, retry_count: { increment: 1 } },
        });
      }
    }

    return successCount;
  }
}
