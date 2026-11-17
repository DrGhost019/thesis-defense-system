"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { formatToJalali } from "@/lib/date-utils";
import { getTranslations } from "@/lib/translations";
import {
  Clock,
  CheckCircle2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  MessageSquare,
  Ban,
  GraduationCap,
  Calendar,
  User,
  X,
} from "lucide-react";

export function MyRequestView({
  onNavigateToMessages,
}: {
  onNavigateToMessages?: (sessionId: number) => void;
}) {
  const { user, lang, calendarType } = useAuth();
  const t = getTranslations(lang);
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [cancelModalSessionId, setCancelModalSessionId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
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
    if (raw.includes("یک درخواست فعال") || raw.includes("active request") || raw.includes("active defense request")) {
      return t.student.activeRequestError;
    }
    if (raw.includes("پروفایل شما ناقص است") || raw.includes("profile")) {
      return t.student.profileIncompleteError;
    }
    if (raw.includes("حداقل ۵ کاراکتر") || raw.includes("characters")) {
      return t.student.cancelReasonMinError;
    }
    if (raw.includes("تنها دانشجو یا اساتید داور") || raw.includes("authorized")) {
      return t.student.cancelForbiddenError;
    }
    if (raw.includes("یافت نشد") || raw.includes("not found")) {
      return t.student.sessionNotFoundError;
    }
    if (raw.includes("فقط جلسات در وضعیت") || raw.includes("status")) {
      return t.student.onlyAssignedOrConfirmedError;
    }
    if (raw.includes("ابتدا وارد سیستم شوید") || raw.includes("authenticate")) {
      return lang === "en" ? "Please authenticate first" : "ابتدا وارد سیستم شوید";
    }
    if (raw.includes("دسترسی مجاز نمی‌باشد") || raw.includes("Access forbidden")) {
      return lang === "en" ? "Access forbidden" : "دسترسی مجاز نمی‌باشد";
    }
    if (lang === "en" && /[\u0600-\u06FF]/.test(raw)) {
      return t.student.genericError;
    }
    return raw || (lang === "fa" ? "خطایی رخ داد" : "An error occurred");
  };

  const { data } = useQuery({
    queryKey: ["my-requests", lang],
    queryFn: async () => {
      const res = await fetch("/api/v1/requests/mine", {
        headers: { "Accept-Language": lang },
      });
      if (!res.ok) throw new Error(lang === "en" ? "Failed to load defense requests" : "خطا در بارگذاری درخواست‌های دفاع");
      return res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (reqNote: string) => {
      const res = await fetch("/api/v1/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": lang,
        },
        body: JSON.stringify({ note: reqNote }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to submit request");
      return resData;
    },
    onSuccess: () => {
      setNote("");
      setSuccessMessage(t.student.requestSubmittedSuccess);
      setErrorMessage(null);
      setCautionMessage(null);
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      setErrorMessage(parseErrorMessage(err));
      setSuccessMessage(null);
      setCautionMessage(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ sessionId, reason }: { sessionId: number; reason: string }) => {
      const res = await fetch(`/api/v1/sessions/${sessionId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": lang,
        },
        body: JSON.stringify({ reason }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.message || "Failed to cancel session");
      return resData;
    },
    onSuccess: () => {
      setCancelModalSessionId(null);
      setCancelReason("");
      setSuccessMessage(t.student.sessionCancelledSuccess);
      setErrorMessage(null);
      setCautionMessage(null);
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      setErrorMessage(parseErrorMessage(err));
      setSuccessMessage(null);
      setCautionMessage(null);
    },
  });

  const requests: any[] = data?.requests || [];
  const activeSession = requests.find((r) =>
    ["requested", "assigned", "confirmed"].includes(r.status)
  );
  const studentProfile = user?.student;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return {
          label: t.student.statusRequested,
          color: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800",
          icon: Clock,
        };
      case "assigned":
        return {
          label: t.student.statusAssigned,
          color: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800",
          icon: Clock,
        };
      case "confirmed":
        return {
          label: t.student.statusConfirmed,
          color: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800",
          icon: CheckCircle2,
        };
      case "rejected":
        return {
          label: t.student.statusDeclined,
          color: "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800",
          icon: XCircle,
        };
      case "cancelled":
        return {
          label: t.student.statusCancelled,
          color: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700",
          icon: Ban,
        };
      default:
        return {
          label: status,
          color: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
          icon: Clock,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Thesis Profile Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-xl">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {t.student.studentInfo}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === "fa"
                ? "این اطلاعات بر اساس پرونده آموزشی شما ثبت شده است"
                : "Authenticated student record from the university academic database"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              {t.student.studentNumber}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
              {studentProfile?.student_number || "---"}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              {t.student.degreeLevel}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {studentProfile?.degree_level === "phd" ? t.student.phd : t.student.master}
            </span>
          </div>

          <div className="sm:col-span-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
              {t.student.thesisTitle}
            </span>
            <span className="font-bold text-slate-900 dark:text-white mt-1 block">
              {studentProfile?.thesis_title || "---"}
            </span>
          </div>
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

      {/* Active Request Tracker */}
      {activeSession ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 block">
                {lang === "fa" ? `درخواست فعال شماره #${activeSession.session_id}` : `Active Request #${activeSession.session_id}`}
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {t.student.activeRequestTitle}
              </h3>
            </div>
            {(() => {
              const badge = getStatusBadge(activeSession.status);
              const BadgeIcon = badge.icon;
              return (
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${badge.color}`}
                >
                  <BadgeIcon className="w-4 h-4" />
                  <span>{badge.label}</span>
                </div>
              );
            })()}
          </div>

          {/* Stepper Visualization */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div
              className={`p-3 rounded-xl border ${
                activeSession.status === "requested"
                  ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 font-bold text-amber-900 dark:text-amber-200"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="text-base font-bold mb-1">1</div>
              <div>{t.student.step1}</div>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                activeSession.status === "assigned"
                  ? "bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 font-bold text-blue-900 dark:text-blue-200"
                  : activeSession.status === "confirmed"
                  ? "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  : "bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400"
              }`}
            >
              <div className="text-base font-bold mb-1">2</div>
              <div>{t.student.step2}</div>
            </div>

            <div
              className={`p-3 rounded-xl border ${
                activeSession.status === "confirmed"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 font-bold text-emerald-900 dark:text-emerald-200"
                  : "bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400"
              }`}
            >
              <div className="text-base font-bold mb-1">3</div>
              <div>{t.student.step3}</div>
            </div>
          </div>

          {/* Assigned details */}
          {activeSession.scheduled_date && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>{t.student.scheduledSessionInfo}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
                    {t.student.scheduledDate}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {calendarType === "jalali"
                      ? formatToJalali(activeSession.scheduled_date.slice(0, 10))
                      : activeSession.scheduled_date.slice(0, 10)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
                    {t.student.scheduledTime}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono" dir="ltr">
                    {activeSession.start_time} - {activeSession.end_time}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">
                    {t.student.examinerFaculty}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {activeSession.slot?.committee?.name ||
                      activeSession.slot?.professor?.user?.full_name ||
                      "---"}
                  </span>
                </div>
              </div>

              {/* Professor seats status */}
              {activeSession.seats && activeSession.seats.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                    {t.student.seatsDecisionTitle}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeSession.seats.map((seat: any) => (
                      <span
                        key={seat.participant_id}
                        className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                          seat.status === "approved"
                            ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-medium"
                            : seat.status === "rejected"
                            ? "bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 font-medium"
                            : "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>{seat.professor.user.full_name}: </span>
                        <span className="font-bold">
                          {seat.status === "approved"
                            ? t.student.seatApproved
                            : seat.status === "rejected"
                            ? t.student.seatRejected
                            : t.student.seatPending}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {activeSession.status === "confirmed" && onNavigateToMessages && (
              <button
                onClick={() => onNavigateToMessages(activeSession.session_id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{t.student.openChatBtn}</span>
              </button>
            )}

            {(activeSession.status === "assigned" || activeSession.status === "confirmed") && (
              <button
                onClick={() => setCancelModalSessionId(activeSession.session_id)}
                className="flex items-center gap-1.5 px-4 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs sm:text-sm font-bold rounded-xl transition"
              >
                <Ban className="w-4 h-4" />
                <span>{t.student.cancelSessionBtn}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* New Request Submission Form (FR-21) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {t.student.newRequestTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t.student.newRequestHelp}
            </p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.student.optionalNote}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t.student.optionalNotePlaceholder}
              className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => submitMutation.mutate(note)}
            disabled={submitMutation.isPending}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-md shadow-blue-500/20 disabled:opacity-60"
          >
            {submitMutation.isPending ? (
              <span>{t.student.submittingRequest}</span>
            ) : (
              <>
                <Send className="w-4 h-4 rtl:rotate-180" />
                <span>{t.student.submitRequestBtn}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* History of Past Sessions */}
      {requests.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            {lang === "fa" ? "تاریخچه درخواست‌های پیشین" : "Defense Requests History"}
          </h3>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {requests.map((req: any) => {
              const badge = getStatusBadge(req.status);
              return (
                <div
                  key={req.session_id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {lang === "fa"
                        ? `درخواست #${req.session_id} - تاریخ ثبت: ${formatToJalali(req.created_at.slice(0, 10))}`
                        : `Request #${req.session_id} - Date: ${req.created_at.slice(0, 10)}`}
                    </div>
                    {req.decision_reason && (
                      <p className="text-red-600 dark:text-red-400 mt-1">
                        {t.student.declineReasonBadge} {req.decision_reason}
                      </p>
                    )}
                    {req.cancel_reason && (
                      <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {lang === "fa" ? "علت لغو:" : "Cancellation Reason:"} {req.cancel_reason}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-bold border self-start sm:self-auto ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModalSessionId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            dir={lang === "fa" ? "rtl" : "ltr"}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-left rtl:text-right"
          >
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" />
              <span>{t.student.cancelModalTitle}</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              {t.student.cancelModalWarning}
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.student.cancelReasonLabel}
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t.student.cancelReasonPlaceholder}
                className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalSessionId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cancelReason.trim().length < 5) {
                    setCautionMessage(t.student.cancelReasonMinCaution);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    return;
                  }
                  cancelMutation.mutate({
                    sessionId: cancelModalSessionId,
                    reason: cancelReason,
                  });
                }}
                disabled={cancelMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition shadow-sm"
              >
                {cancelMutation.isPending ? t.student.cancelling : t.student.confirmCancelBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
