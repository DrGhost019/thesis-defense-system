"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { getTranslations } from "@/lib/translations";
import { BellRing, RefreshCw, AlertTriangle, UserX, CheckCircle, Loader2 } from "lucide-react";

export function ReportsView() {
  const { lang } = useAuth();
  const t = getTranslations(lang);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const res = await fetch("/api/v1/admin/reports");
      if (!res.ok) throw new Error("Failed to load reports");
      return res.json();
    },
  });

  const failedNotifications: any[] = data?.failedNotifications || [];
  const unlinkedUsers: any[] = data?.unlinkedUsers || [];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BellRing className="w-5 h-5 text-blue-600" />
            <span>{t.reports.title}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.reports.desc}
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t.common.refresh}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Failed Notifications */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>
                {t.reports.failedDeliveriesTitle} ({failedNotifications.length})
              </span>
            </h3>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
              <span className="text-xs">{t.common.loading}</span>
            </div>
          ) : failedNotifications.length === 0 ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <span>{t.reports.noFailedNotifs}</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {failedNotifications.map((notif: any) => (
                <div key={notif.notification_id} className="py-3 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span>
                      {t.reports.recipient} {notif.recipient.full_name} ({notif.recipient.username})
                    </span>
                    <span className="text-red-600 dark:text-red-400 text-[10px] bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                      {t.reports.attempts} {notif.retry_count}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    {t.reports.event}{" "}
                    {notif.type === "outcome"
                      ? lang === "fa"
                        ? "نتیجه درخواست دفاع"
                        : "Session Outcome"
                      : lang === "fa"
                      ? "یادآوری جلسه"
                      : "Daily Reminder"}
                  </div>
                  <div className="text-red-500 dark:text-red-400 font-mono text-[11px]">
                    {t.reports.errorReason}{" "}
                    {notif.failure_reason || (lang === "fa" ? "خطای ارسال به ربات بله" : "Gateway Error")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unlinked Users */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserX className="w-4 h-4 text-amber-600" />
              <span>
                {t.reports.unlinkedUsersTitle} ({unlinkedUsers.length})
              </span>
            </h3>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
              <span className="text-xs">{t.common.loading}</span>
            </div>
          ) : unlinkedUsers.length === 0 ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/60 rounded-xl">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              <span>{t.reports.noUnlinkedUsers}</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
              {unlinkedUsers.map((u: any) => (
                <div
                  key={u.user_id}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {u.full_name}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 font-mono mx-1.5" dir="ltr">
                      ({u.username})
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {u.role === "student"
                      ? t.navbar.student
                      : u.role === "professor"
                      ? t.navbar.professor
                      : t.navbar.admin}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
