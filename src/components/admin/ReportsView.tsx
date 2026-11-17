"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { getTranslations } from "@/lib/translations";
import { BellRing, RefreshCw, AlertTriangle, UserX, CheckCircle, Loader2, X } from "lucide-react";

export function ReportsView() {
  const { lang } = useAuth();
  const t = getTranslations(lang);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cautionMessage, setCautionMessage] = useState<string | null>(null);

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (cautionMessage) {
      const timer = setTimeout(() => {
        setCautionMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [cautionMessage]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-reports", lang],
    queryFn: async () => {
      const res = await fetch("/api/v1/admin/reports", {
        headers: { "Accept-Language": lang },
      });
      if (!res.ok) throw new Error(lang === "en" ? "Failed to load reports" : "خطا در بارگذاری گزارش‌ها");
      return res.json();
    },
  });

  const failedNotifications: any[] = data?.failedNotifications || [];
  const unlinkedUsers: any[] = data?.unlinkedUsers || [];

  const [isRetrying, setIsRetrying] = useState(false);

  const handleRefresh = async () => {
    try {
      await refetch();
      setSuccessMessage(t.reports.refreshSuccess);
      setErrorMessage(null);
      setCautionMessage(null);
    } catch {
      setErrorMessage(lang === "en" ? "Failed to load reports." : "خطا در بارگذاری گزارش‌ها");
      setSuccessMessage(null);
      setCautionMessage(null);
    }
  };

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch("/api/v1/admin/reports/retry", {
        method: "POST",
        headers: { "Accept-Language": lang },
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || (lang === "en" ? "Failed to retry notifications." : "خطا در تلاش مجدد اعلان‌ها"));
      }
      await refetch();
      if (result.failed > 0 && result.sent === 0) {
        setErrorMessage(result.message);
        setSuccessMessage(null);
        setCautionMessage(null);
      } else {
        setSuccessMessage(result.message);
        setErrorMessage(null);
        setCautionMessage(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || (lang === "en" ? "Failed to retry notifications." : "خطا در تلاش مجدد اعلان‌ها"));
      setSuccessMessage(null);
      setCautionMessage(null);
    } finally {
      setIsRetrying(false);
    }
  };

  const formatFailureReason = (reason: string | null): string => {
    if (!reason) return lang === "fa" ? "خطای ارسال به ربات بله" : "Bale Gateway Error";
    if (lang === "fa") return reason;
    if (reason.includes("توکن محرمانه") || reason.includes("token") || reason.includes("FORBIDDEN")) {
      return "Invalid secret token";
    }
    if (reason.includes("یافت نشد") || reason.includes("not found")) {
      return "Recipient or chat ID not found";
    }
    if (reason.includes("مسدود") || reason.includes("blocked")) {
      return "Bot blocked by recipient";
    }
    if (reason.includes("هم‌پوشانی") || reason.includes("تداخل") || reason.includes("conflict")) {
      return "Scheduling conflict";
    }
    if (reason.includes("خطای ارسال") || reason.includes("Send failed") || reason.includes("Delivery failed")) {
      return "Delivery failed to Bale Messenger";
    }
    if (/[\u0600-\u06FF]/.test(reason)) {
      return "Delivery failed to Bale Messenger";
    }
    return reason;
  };

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

        <div className="flex items-center gap-2">
          {failedNotifications.length > 0 && (
            <button
              onClick={handleRetryFailed}
              disabled={isRetrying}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              <span>{isRetrying ? t.reports.retrying : t.reports.retryAllBtn}</span>
            </button>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.common.refresh}</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div
          dir={lang === "fa" ? "rtl" : "ltr"}
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center justify-between gap-2 animate-in fade-in text-left rtl:text-right"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span className="text-left rtl:text-right">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200 p-1 flex-shrink-0"
            title={t.datepicker.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          dir={lang === "fa" ? "rtl" : "ltr"}
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center justify-between gap-2 animate-in fade-in text-left rtl:text-right"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span className="text-left rtl:text-right">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 p-1 flex-shrink-0"
            title={t.datepicker.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {cautionMessage && (
        <div
          dir={lang === "fa" ? "rtl" : "ltr"}
          className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs sm:text-sm flex items-center justify-between gap-2 animate-in fade-in text-left rtl:text-right"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600" />
            <span className="text-left rtl:text-right">{cautionMessage}</span>
          </div>
          <button
            onClick={() => setCautionMessage(null)}
            className="text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 p-1 flex-shrink-0"
            title={t.datepicker.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
            {failedNotifications.length > 0 && (
              <button
                onClick={() => {
                  setErrorMessage(
                    lang === "en"
                      ? `${failedNotifications.length} notification${failedNotifications.length > 1 ? "s" : ""} failed delivery and pending retry.`
                      : `${failedNotifications.length} اعلان با خطای ارسال مواجه شده است.`
                  );
                  setSuccessMessage(null);
                  setCautionMessage(null);
                }}
                className="text-[11px] font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
              >
                {t.reports.warningBadge}
              </button>
            )}
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
                    {t.reports.errorReason} {formatFailureReason(notif.failure_reason)}
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
            {unlinkedUsers.length > 0 && (
              <button
                onClick={() => {
                  setCautionMessage(
                    lang === "en"
                      ? `${unlinkedUsers.length} user${unlinkedUsers.length > 1 ? "s" : ""} have not linked their Bale Messenger accounts.`
                      : `${unlinkedUsers.length} کاربر هنوز به پیام‌رسان بله متصل نشده‌اند.`
                  );
                  setSuccessMessage(null);
                  setErrorMessage(null);
                }}
                className="text-[11px] font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400"
              >
                {t.reports.warningBadge}
              </button>
            )}
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
