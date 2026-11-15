import prisma from "@/lib/prisma";
import { AuthenticatedUser } from "@/lib/server-auth";

export class DashboardService {
  public static async getDashboardData(user: AuthenticatedUser) {
    const role = user.role;

    if (role === "student" && user.studentId) {
      const activeSession = await prisma.defenseSession.findFirst({
        where: {
          student_id: user.studentId,
          status: { in: ["requested", "assigned", "confirmed"] },
        },
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

      const recentSessions = await prisma.defenseSession.findMany({
        where: { student_id: user.studentId },
        include: {
          slot: {
            include: {
              professor: { include: { user: { select: { full_name: true } } } },
              committee: { select: { name: true } },
            },
          },
        },
        orderBy: { created_at: "desc" },
        take: 5,
      });

      const notices: { id: string; type: string; title: string; text: string; date: Date }[] = [];

      if (activeSession) {
        if (activeSession.status === "requested") {
          notices.push({
            id: `req_${activeSession.session_id}`,
            type: "info",
            title: "درخواست در انتظار بررسی",
            text: "درخواست دفاع شما ثبت شده و در نوبت بررسی توسط اداره آموزش قرار دارد.",
            date: activeSession.created_at,
          });
        } else if (activeSession.status === "assigned") {
          notices.push({
            id: `assign_${activeSession.session_id}`,
            type: "warning",
            title: "تخصیص تاریخ دفاع",
            text: `تاریخ دفاع شما برای ${activeSession.scheduled_date?.toISOString().slice(0, 10)} تعیین شده و در انتظار تأیید داوران است.`,
            date: activeSession.assigned_at || activeSession.created_at,
          });
        } else if (activeSession.status === "confirmed") {
          notices.push({
            id: `conf_${activeSession.session_id}`,
            type: "success",
            title: "تأیید نهایی جلسه دفاع",
            text: `جلسه دفاع شما قطعی شد. لطفاً در صورت نیاز از بخش پیام‌ها با هیئت داوران در ارتباط باشید.`,
            date: activeSession.confirmed_at || activeSession.created_at,
          });
        }
      }

      return {
        role,
        activeSession,
        recentSessions,
        notices,
        baleLinked: !!(await prisma.user.findUnique({ where: { user_id: user.userId } }))?.bale_chat_id,
      };
    }

    if ((role === "professor" || role === "higher_education_staff") && user.professorId) {
      const pendingSeats = await prisma.defenseParticipant.findMany({
        where: {
          professor_id: user.professorId,
          status: "pending",
          session: { status: "assigned" },
        },
        include: {
          session: {
            include: {
              student: { include: { user: { select: { full_name: true } } } },
              slot: {
                include: {
                  committee: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      const upcomingSessions = await prisma.defenseParticipant.findMany({
        where: {
          professor_id: user.professorId,
          session: { status: "confirmed" },
        },
        include: {
          session: {
            include: {
              student: { include: { user: { select: { full_name: true } } } },
            },
          },
        },
        orderBy: { session: { scheduled_date: "asc" } },
        take: 5,
      });

      const recentCancellations = await prisma.defenseParticipant.findMany({
        where: {
          professor_id: user.professorId,
          session: { status: "cancelled" },
        },
        include: {
          session: {
            include: {
              student: { include: { user: { select: { full_name: true } } } },
              cancelled_by: { select: { full_name: true } },
            },
          },
        },
        orderBy: { session: { cancelled_at: "desc" } },
        take: 3,
      });

      const notices = pendingSeats.map((seat) => ({
        id: `seat_${seat.participant_id}`,
        type: "action_required",
        title: "درخواست داوری جدید",
        text: `جلسه دفاع دانشجو ${seat.session.student.user.full_name} به شما اختصاص یافته و نیازمند اعلام نظر شماست.`,
        date: seat.session.assigned_at || new Date(),
        actionUrl: "/assigned-defenses",
      }));

      return {
        role,
        pendingSeatsCount: pendingSeats.length,
        pendingSeats,
        upcomingSessions,
        recentCancellations,
        notices,
        baleLinked: !!(await prisma.user.findUnique({ where: { user_id: user.userId } }))?.bale_chat_id,
      };
    }

    if (role === "admin") {
      const [pendingRequestsCount, totalStudents, totalProfessors, totalCommittees, unlinkedUsersCount, failedNotificationsCount] =
        await Promise.all([
          prisma.defenseSession.count({ where: { status: "requested" } }),
          prisma.student.count(),
          prisma.professor.count(),
          prisma.committee.count({ where: { is_active: true } }),
          prisma.user.count({ where: { bale_chat_id: null, is_active: true } }),
          prisma.notification.count({ where: { status: "failed" } }),
        ]);

      const pendingRequests = await prisma.defenseSession.findMany({
        where: { status: "requested" },
        include: {
          student: {
            include: {
              user: { select: { full_name: true } },
            },
          },
        },
        orderBy: { created_at: "asc" },
        take: 5,
      });

      const notices: { id: string; type: string; title: string; text: string; date: Date; actionUrl?: string }[] = [];

      if (pendingRequestsCount > 0) {
        notices.push({
          id: "admin_pending",
          type: "action_required",
          title: "درخواست‌های در انتظار تخصیص",
          text: `تعداد ${pendingRequestsCount} درخواست دفاع در انتظار تخصیص زمان و استاد هستند.`,
          date: new Date(),
          actionUrl: "/requests",
        });
      }

      if (failedNotificationsCount > 0) {
        notices.push({
          id: "admin_failed_notif",
          type: "warning",
          title: "خطا در ارسال پیام‌های بله",
          text: `تعداد ${failedNotificationsCount} اعلان بله با خطا مواجه شده است.`,
          date: new Date(),
          actionUrl: "/admin/reports",
        });
      }

      return {
        role,
        stats: {
          pendingRequestsCount,
          totalStudents,
          totalProfessors,
          totalCommittees,
          unlinkedUsersCount,
          failedNotificationsCount,
        },
        pendingRequests,
        notices,
      };
    }

    return { role, notices: [] };
  }
}
