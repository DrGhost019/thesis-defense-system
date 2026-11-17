"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { formatToJalali } from "@/lib/date-utils";
import { getTranslations } from "@/lib/translations";
import {
  CheckSquare,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  GraduationCap,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";

export function AssignedDefensesView() {
  const { lang, calendarType } = useAuth();
  const t = getTranslations(lang);
  const queryClient = useQueryClient();
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

  const parseErrorMessage = (err: any): string => {
    const raw = String(err?.message || "");
    if (raw.includes("کرسی داوری یافت نشد") || raw.includes("not found")) {
      return t.assignedDefenses.seatNotFoundError;
    }
    if (raw.includes("اجازه ثبت نظر") || raw.includes("forbidden") || raw.includes("FORBIDDEN")) {
      return t.assignedDefenses.forbiddenSeatError;
    }
    if (raw.includes("وضعیت انتظار تایید") || raw.includes("no longer awaiting")) {
      return t.assignedDefenses.notInAssignedStatusError;
    }
    if (raw.includes("قبلاً ثبت شده") || raw.includes("already been recorded")) {
      return t.assignedDefenses.decisionAlreadyRecordedError;
    }
    if (raw.includes("ابتدا وارد سیستم شوید") || raw.includes("authenticate")) {
      return lang === "en" ? "Please authenticate first" : "ابتدا وارد سیستم شوید";
    }
    if (raw.includes("دسترسی مجاز نمی‌باشد") || raw.includes("Access forbidden")) {
      return lang === "en" ? "Access forbidden" : "دسترسی مجاز نمی‌باشد";
    }
    if (lang === "en" && /[\u0600-\u06FF]/.test(raw)) {
      return t.assignedDefenses.genericError;
    }
    return raw || (lang === "fa" ? "خطایی رخ داد" : "An error occurred");
  };

  const { data, isLoading } = useQuery({
    queryKey: ["assigned-seats", lang],
    queryFn: async () => {
      const res = await fetch("/api/v1/seats/mine", {
        headers: { "Accept-Language": lang },
      });
      if (!res.ok) throw new Error(lang === "en" ? "Failed to load assigned defense sessions" : "خطا در بارگذاری جلسات محول‌شده");
      return res.json();
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ seatId, approve }: { seatId: number; approve: boolean }) => {
      const res = await fetch(`/api/v1/seats/${seatId}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": lang,
        },
        body: JSON.stringify({ approve }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to record decision");
      return resData;
    },
    onSuccess: (resData) => {
      setErrorMessage(null);
      setSuccessMessage(null);
      setCautionMessage(null);

      if (resData.sessionStatus === "confirmed") {
        setSuccessMessage(t.assignedDefenses.allConfirmedSuccess);
      } else if (resData.seatStatus === "rejected") {
        setErrorMessage(t.assignedDefenses.declinedSuccess);
      } else if (resData.seatStatus === "approved") {
        setCautionMessage(t.assignedDefenses.awaitingOthersCaution);
      } else {
        setSuccessMessage(t.assignedDefenses.decisionRecordedSuccess);
      }
      queryClient.invalidateQueries({ queryKey: ["assigned-seats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      setErrorMessage(parseErrorMessage(err));
      setSuccessMessage(null);
      setCautionMessage(null);
    },
  });

  const seats: any[] = data?.seats || [];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-blue-600" />
          <span>{t.assignedDefenses.title}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t.assignedDefenses.desc}
        </p>
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

      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-slate-400 border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <span>{t.common.loading}</span>
        </div>
      ) : seats.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 text-sm">
          {t.assignedDefenses.noPendingDecisions}
        </div>
      ) : (
        <div className="space-y-4">
          {seats.map((seat: any) => {
            const session = seat.session;
            const student = session.student;
            const studentUser = student.user;
            const scheduledDate = session.scheduled_date?.slice(0, 10);

            return (
              <div
                key={seat.participant_id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-blue-300 dark:hover:border-blue-700 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-xl">
                      <GraduationCap className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {studentUser.full_name} (
                        {student.degree_level === "phd" ? t.student.phd : t.student.master})
                      </h3>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                        {t.assignedDefenses.studentNumber} {student.student_number}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      {calendarType === "jalali" ? formatToJalali(scheduledDate) : scheduledDate}
                    </span>
                    <span className="flex items-center gap-1 font-mono" dir="ltr">
                      <Clock className="w-4 h-4 text-blue-600" />
                      {session.start_time} - {session.end_time}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 block mb-0.5">
                    {t.assignedDefenses.thesisTitle}
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                    {student.thesis_title}
                  </p>
                </div>

                {session.note && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {lang === "fa" ? "توضیحات دانشجو:" : "Student Note:"}{" "}
                    </span>
                    {session.note}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          lang === "fa"
                            ? "آیا از رد این جلسه دفاع اطمینان دارید؟ جلسه لغو و تاریخ آزاد خواهد شد."
                            : "Are you sure you want to reject this session assignment?"
                        )
                      ) {
                        decisionMutation.mutate({ seatId: seat.participant_id, approve: false });
                      }
                    }}
                    disabled={decisionMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t.assignedDefenses.rejectBtn}</span>
                  </button>

                  <button
                    onClick={() =>
                      decisionMutation.mutate({ seatId: seat.participant_id, approve: true })
                    }
                    disabled={decisionMutation.isPending}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{t.assignedDefenses.approveBtn}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
