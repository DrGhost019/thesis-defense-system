"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { formatToJalali, toTehranDateString, toPersianDigits } from "@/lib/date-utils";
import { getTranslations } from "@/lib/translations";
import { TabId } from "../layout/Navigation";
import {
  CalendarDays,
  FileText,
  Clock,
  CheckSquare,
  Bell,
  ArrowRight,
  Shield,
  GraduationCap,
  Calendar,
  User,
} from "lucide-react";

export function DashboardView({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { user, lang, calendarType } = useAuth();
  const t = getTranslations(lang);

  const { data } = useQuery({
    queryKey: ["dashboard", lang],
    queryFn: async () => {
      const res = await fetch("/api/v1/me/dashboard", {
        headers: { "Accept-Language": lang },
      });
      if (!res.ok) throw new Error("Failed to load dashboard data");
      return res.json();
    },
  });

  const notices: any[] = data?.notices || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-blue-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs font-semibold text-blue-200 border border-white/10">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              {t.dashboard.today}{" "}
              {calendarType === "jalali"
                ? formatToJalali(toTehranDateString(new Date()))
                : toTehranDateString(new Date())}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            {t.dashboard.welcome.replace("{name}", user?.fullName || "")}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            {user?.role === "student"
              ? t.dashboard.studentDesc
              : user?.role === "admin"
              ? t.dashboard.adminDesc
              : t.dashboard.profDesc}
          </p>
        </div>

        <div className="absolute left-6 bottom-0 opacity-10 pointer-events-none hidden sm:block">
          <GraduationCap className="w-48 h-48" />
        </div>
      </div>

      {/* In-app Notices & Alerts (FR-44) */}
      {notices.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-600" />
            <span>{t.dashboard.noticesTitle}</span>
          </h3>

          <div className="space-y-2.5">
            {notices.map((n: any) => {
              let noticeTitle =
                lang === "en"
                  ? n.titleEn ||
                    (n.id === "admin_pending"
                      ? "Requests Awaiting Assignment"
                      : n.id === "admin_failed_notif"
                      ? "Bale Messenger Delivery Failures"
                      : n.title)
                  : n.titleFa || n.title;

              let noticeText =
                lang === "en"
                  ? n.textEn ||
                    (n.id === "admin_pending"
                      ? `${n.count || data?.stats?.pendingRequestsCount || 1} defense request${(n.count || data?.stats?.pendingRequestsCount || 1) > 1 ? "s" : ""} awaiting slot and committee assignment.`
                      : n.id === "admin_failed_notif"
                      ? `${n.count || data?.stats?.failedNotificationsCount || 0} Bale notification${(n.count || data?.stats?.failedNotificationsCount || 0) > 1 ? "s" : ""} failed delivery.`
                      : n.text)
                  : n.textFa || n.text;

              if (lang === "en" && /[\u0600-\u06FF]/.test(noticeTitle)) {
                if (n.id?.startsWith("seat_")) noticeTitle = "New Defense Review Request";
                else if (n.id?.startsWith("req_")) noticeTitle = "Request Awaiting Review";
                else if (n.id?.startsWith("assign_")) noticeTitle = "Defense Date Assigned";
                else if (n.id?.startsWith("conf_")) noticeTitle = "Defense Session Confirmed";
                else if (n.id === "admin_pending") noticeTitle = "Requests Awaiting Assignment";
                else if (n.id === "admin_failed_notif") noticeTitle = "Bale Messenger Delivery Failures";
                else noticeTitle = "System Notification";
              }

              if (lang === "en" && /[\u0600-\u06FF]/.test(noticeText)) {
                if (n.id?.startsWith("seat_")) noticeText = "A defense session has been assigned to you and awaits your evaluation.";
                else if (n.id?.startsWith("req_")) noticeText = "Your defense request has been submitted and is currently queued for academic review.";
                else if (n.id?.startsWith("assign_")) noticeText = "Your defense date has been scheduled and is awaiting examiner approval.";
                else if (n.id?.startsWith("conf_")) noticeText = "Your defense session is confirmed. You can communicate with the evaluation committee via messages.";
                else noticeText = "A system update is available for your account.";
              }

              if (lang === "fa") {
                noticeText = toPersianDigits(noticeText);
              }

              return (
                <div
                  key={n.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm shadow-2xs ${
                    n.type === "action_required"
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                      : n.type === "warning"
                      ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
                      : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  }`}
                >
                  <div>
                    <div className="font-bold">{noticeTitle}</div>
                    <div className="text-xs opacity-90 mt-0.5">{noticeText}</div>
                  </div>

                  {n.actionUrl && (
                    <button
                      onClick={() => {
                        if (n.actionUrl === "/requests") onNavigate("requests");
                        if (n.actionUrl === "/assigned-defenses") onNavigate("assigned-defenses");
                        if (n.actionUrl === "/admin/reports") onNavigate("reports");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 rounded-lg text-xs font-bold border border-current shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700 self-start sm:self-auto transition"
                    >
                      <span>{t.dashboard.viewAction}</span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Role-Specific Metric Cards */}
      {user?.role === "admin" && data?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div
            onClick={() => onNavigate("requests")}
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-400 transition"
          >
            <span className="text-[11px] text-slate-400 font-semibold block">
              {t.dashboard.pendingRequests}
            </span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">
              {lang === "fa" ? toPersianDigits(data.stats.pendingRequestsCount) : data.stats.pendingRequestsCount}
            </span>
          </div>

          <div
            onClick={() => onNavigate("committees")}
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-400 transition"
          >
            <span className="text-[11px] text-slate-400 font-semibold block">
              {t.dashboard.activeCommittees}
            </span>
            <span className="text-2xl font-black text-purple-600 mt-1 block">
              {lang === "fa" ? toPersianDigits(data.stats.totalCommittees) : data.stats.totalCommittees}
            </span>
          </div>

          <div
            onClick={() => onNavigate("accounts")}
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-400 transition"
          >
            <span className="text-[11px] text-slate-400 font-semibold block">
              {t.dashboard.registeredFaculty}
            </span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block">
              {lang === "fa" ? toPersianDigits(data.stats.totalProfessors) : data.stats.totalProfessors}
            </span>
          </div>

          <div
            onClick={() => onNavigate("accounts")}
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-400 transition"
          >
            <span className="text-[11px] text-slate-400 font-semibold block">
              {t.dashboard.students}
            </span>
            <span className="text-2xl font-black text-blue-600 mt-1 block">
              {lang === "fa" ? toPersianDigits(data.stats.totalStudents) : data.stats.totalStudents}
            </span>
          </div>

          <div
            onClick={() => onNavigate("reports")}
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-400 transition"
          >
            <span className="text-[11px] text-slate-400 font-semibold block">
              {t.dashboard.unlinkedBale}
            </span>
            <span className="text-2xl font-black text-slate-600 dark:text-slate-300 mt-1 block">
              {lang === "fa" ? toPersianDigits(data.stats.unlinkedUsersCount) : data.stats.unlinkedUsersCount}
            </span>
          </div>

          <div
            onClick={() => onNavigate("reports")}
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-400 transition"
          >
            <span className="text-[11px] text-slate-400 font-semibold block">
              {t.dashboard.failedNotifications}
            </span>
            <span className="text-2xl font-black text-red-600 mt-1 block">
              {lang === "fa" ? toPersianDigits(data.stats.failedNotificationsCount) : data.stats.failedNotificationsCount}
            </span>
          </div>
        </div>
      )}

      {/* Fast Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate("schedule")}
          className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition group"
        >
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl w-fit mb-3 group-hover:bg-blue-600 group-hover:text-white transition">
            <CalendarDays className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {t.dashboard.cardScheduleTitle}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.dashboard.cardScheduleDesc}
          </p>
        </div>

        {user?.role === "student" && (
          <div
            onClick={() => onNavigate("my-request")}
            className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition group"
          >
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl w-fit mb-3 group-hover:bg-emerald-600 group-hover:text-white transition">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.dashboard.cardRequestTitle}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t.dashboard.cardRequestDesc}
            </p>
          </div>
        )}

        {(user?.role === "professor" || user?.role === "higher_education_staff") && (
          <>
            <div
              onClick={() => onNavigate("my-slots")}
              className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition group"
            >
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl w-fit mb-3 group-hover:bg-indigo-600 group-hover:text-white transition">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {t.dashboard.cardSlotsTitle}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t.dashboard.cardSlotsDesc}
              </p>
            </div>

            <div
              onClick={() => onNavigate("assigned-defenses")}
              className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition group"
            >
              <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl w-fit mb-3 group-hover:bg-amber-600 group-hover:text-white transition">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {t.dashboard.cardAssignedTitle}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t.dashboard.cardAssignedDesc}
              </p>
            </div>
          </>
        )}

        {user?.role === "admin" && (
          <div
            onClick={() => onNavigate("requests")}
            className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition group"
          >
            <div className="p-3 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl w-fit mb-3 group-hover:bg-purple-600 group-hover:text-white transition">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.dashboard.cardAdminAssignTitle}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t.dashboard.cardAdminAssignDesc}
            </p>
          </div>
        )}

        <div
          onClick={() => onNavigate("profile")}
          className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition group"
        >
          <div className="p-3 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-xl w-fit mb-3 group-hover:bg-sky-600 group-hover:text-white transition">
            <User className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            {t.dashboard.cardProfileTitle}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.dashboard.cardProfileDesc}
          </p>
        </div>
      </div>
    </div>
  );
}
