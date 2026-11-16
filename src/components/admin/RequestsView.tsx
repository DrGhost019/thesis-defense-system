"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { formatToJalali } from "@/lib/date-utils";
import { getTranslations } from "@/lib/translations";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  FileText,
  Calendar,
  XCircle,
  AlertTriangle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";

export function RequestsView() {
  const { lang, calendarType } = useAuth();
  const t = getTranslations(lang);
  const queryClient = useQueryClient();

  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [declineModalSessionId, setDeclineModalSessionId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const parseErrorMessage = (err: any): string => {
    const raw = String(err?.message || "");
    if (raw.includes("یافت نشد") || raw.includes("not found") || raw.includes("NOT_FOUND")) {
      return t.adminRequests.requestNotFoundError;
    }
    if (raw.includes("فردا") || raw.includes("tomorrow") || raw.includes("حداقل برای فردا")) {
      return t.adminRequests.dateMustBeTomorrowError;
    }
    if (raw.includes("رزرو شده") || raw.includes("already booked")) {
      return t.adminRequests.slotAlreadyBookedError;
    }
    if (raw.includes("مطابقت ندارد") || raw.includes("pattern") || raw.includes("match")) {
      return t.adminRequests.patternMismatchError;
    }
    if (raw.includes("تداخل زمانی") || raw.includes("conflict")) {
      return t.adminRequests.professorConflictError;
    }
    if (raw.includes("هیئت داوران") && (raw.includes("غیرفعال") || raw.includes("deactivated"))) {
      return t.adminRequests.committeeDeactivatedError;
    }
    if (raw.includes("هیچ استاد فعالی") || raw.includes("No active faculty")) {
      return t.adminRequests.noActiveProfessorsError;
    }
    if (raw.includes("درخواست شده") || raw.includes("requested")) {
      return t.adminRequests.onlyRequestedStatusError;
    }
    if (raw.includes("علت رد") || raw.includes("۵ کاراکتر") || raw.includes("characters")) {
      return t.adminRequests.declineReasonMinError;
    }
    if (raw.includes("بازه زمانی یافت نشد") || raw.includes("Time slot not found")) {
      return t.adminRequests.slotNotFoundError;
    }
    return raw || (lang === "fa" ? "خطایی رخ داد" : "An error occurred");
  };

  // Fetch pending requests
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["admin-pending-requests"],
    queryFn: async () => {
      const res = await fetch("/api/v1/requests?status=requested");
      if (!res.ok) throw new Error("Failed to load requests");
      return res.json();
    },
  });

  // Fetch all available slots for assignment
  const { data: scheduleData } = useQuery({
    queryKey: ["schedule-current"],
    queryFn: async () => {
      const res = await fetch("/api/v1/schedule");
      if (!res.ok) throw new Error("Failed to load schedule");
      return res.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      sessionId,
      slotId,
      date,
    }: {
      sessionId: number;
      slotId: number;
      date: string;
    }) => {
      const res = await fetch(`/api/v1/requests/${sessionId}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": lang,
        },
        body: JSON.stringify({ slot_id: slotId, scheduled_date: date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to assign slot");
      return data;
    },
    onSuccess: () => {
      setSuccessMessage(t.adminRequests.assignedSuccess);
      setErrorMessage(null);
      setSelectedSession(null);
      setSelectedSlotId("");
      setSelectedDate("");
      queryClient.invalidateQueries({ queryKey: ["admin-pending-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      setErrorMessage(parseErrorMessage(err));
      setSuccessMessage(null);
    },
  });

  const declineMutation = useMutation({
    mutationFn: async ({ sessionId, reason }: { sessionId: number; reason: string }) => {
      const res = await fetch(`/api/v1/requests/${sessionId}/decline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": lang,
        },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to decline request");
      return data;
    },
    onSuccess: () => {
      setSuccessMessage(t.adminRequests.declinedSuccess);
      setErrorMessage(null);
      setDeclineModalSessionId(null);
      setDeclineReason("");
      setSelectedSession(null);
      queryClient.invalidateQueries({ queryKey: ["admin-pending-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      setErrorMessage(parseErrorMessage(err));
      setSuccessMessage(null);
    },
  });

  const pendingRequests = requestsData?.items || [];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>{t.adminRequests.title}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.adminRequests.desc}
          </p>
        </div>
        <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 rounded-full text-xs font-bold border border-amber-200 dark:border-amber-800">
          {pendingRequests.length} {lang === "fa" ? "درخواست در نوبت" : "Queued Requests"}
        </span>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Requests List / Right Detail and Assignment with Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Requests List (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
            <span>{t.adminRequests.pendingQueueTitle}</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
              {t.adminRequests.oldestFirstBadge}
            </span>
          </h3>

          {requestsLoading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <span>{t.common.loading}</span>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              {t.adminRequests.noPendingRequests}
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingRequests.map((req: any) => {
                const isSelected = selectedSession?.session_id === req.session_id;
                const student = req.student;
                return (
                  <div
                    key={req.session_id}
                    onClick={() => {
                      setSelectedSession(req);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition text-xs ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white mb-1">
                      <span>{student.user.full_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">#{req.session_id}</span>
                    </div>

                    <div className="text-slate-500 dark:text-slate-400 line-clamp-1 mb-1 font-medium">
                      {student.thesis_title}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700">
                      <span>
                        {t.adminRequests.degree}{" "}
                        {student.degree_level === "phd" ? t.student.phd : t.student.master}
                      </span>
                      <span>
                        {t.adminRequests.submissionDate}{" "}
                        {calendarType === "jalali"
                          ? formatToJalali(req.created_at.slice(0, 10))
                          : req.created_at.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignment & Weekly Grid Detail Pane (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          {selectedSession ? (
            <>
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {t.adminRequests.assignmentPanelTitle} #{selectedSession.session_id}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t.student.studentInfo}:{" "}
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedSession.student.user.full_name}
                    </span>{" "}
                    ({t.student.studentNumber} {selectedSession.student.student_number})
                  </div>
                </div>

                <button
                  onClick={() => setDeclineModalSessionId(selectedSession.session_id)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold transition"
                >
                  {t.adminRequests.declineBtn}
                </button>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
                <div>
                  <span className="text-slate-400 dark:text-slate-500">
                    {t.student.thesisTitle}{" "}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedSession.student.thesis_title}
                  </span>
                </div>
                {selectedSession.note && (
                  <div>
                    <span className="text-slate-400 dark:text-slate-500">
                      {t.student.optionalNote}:{" "}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {selectedSession.note}
                    </span>
                  </div>
                )}
              </div>

              {/* Assignment Form */}
              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>{t.adminRequests.selectSlotLabel}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.adminRequests.selectSlotLabel}
                    </label>
                    <select
                      value={selectedSlotId}
                      onChange={(e) => setSelectedSlotId(e.target.value)}
                      className="w-full p-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="">-- {t.slots.selectCommittee} --</option>
                      {scheduleData?.days?.flatMap((d: any) => d.blocks).map((b: any) => (
                        <option key={`${b.slot_id}_${b.date}`} value={b.slot_id}>
                          {b.owner_name} ({b.start_time}-{b.end_time}) -{" "}
                          {b.slot_type === "single" ? t.slots.singleType : t.slots.recurringType}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.adminRequests.selectDateLabel}
                    </label>
                    <DatePicker
                      value={selectedDate}
                      onChange={setSelectedDate}
                      required
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!selectedSlotId || !selectedDate) {
                      setErrorMessage(t.adminRequests.slotAndDateRequiredError);
                      return;
                    }
                    assignMutation.mutate({
                      sessionId: selectedSession.session_id,
                      slotId: parseInt(selectedSlotId, 10),
                      date: selectedDate,
                    });
                  }}
                  disabled={assignMutation.isPending}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm disabled:opacity-60"
                >
                  {assignMutation.isPending
                    ? t.adminRequests.assigning
                    : t.adminRequests.confirmAssignmentBtn}
                </button>
              </div>

              {/* Reference Grid beside the request */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {lang === "fa" ? "نمای بازه‌های جاری در جدول:" : "Current Available Slots in Grid:"}
                </h4>
                <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                  {scheduleData?.days?.map((day: any) => (
                    <div
                      key={day.date}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {lang === "fa" ? day.weekday_name_fa : day.weekday_name_en}
                      </div>
                      <div className="text-slate-400 dark:text-slate-500 text-[9px] mb-1">
                        {calendarType === "jalali" ? formatToJalali(day.date) : day.date}
                      </div>
                      <div className="space-y-1">
                        {day.blocks.length === 0 ? (
                          <div className="text-slate-300 dark:text-slate-600 italic">
                            {lang === "fa" ? "خالی" : "Empty"}
                          </div>
                        ) : (
                          day.blocks.map((b: any) => (
                            <div
                              key={b.slot_id}
                              onClick={() => {
                                setSelectedSlotId(String(b.slot_id));
                                setSelectedDate(b.date);
                              }}
                              className="p-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer shadow-2xs truncate"
                              title={`${b.owner_name} (${b.start_time}-${b.end_time})`}
                            >
                              <div className="font-bold truncate text-[10px] text-slate-800 dark:text-slate-200">
                                {b.owner_name}
                              </div>
                              <div className="text-[9px] text-slate-500 font-mono" dir="ltr">
                                {b.start_time}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
              <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <span>
                {lang === "fa"
                  ? "یک درخواست را از لیست سمت راست انتخاب نمایید تا جزئیات و پنل تخصیص نمایش داده شود."
                  : "Select a request from the queue to view details and scheduling options."}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Decline Reason Modal */}
      {declineModalSessionId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span>{t.adminRequests.declineModalTitle}</span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {lang === "fa"
                ? "دلیل رد درخواست الزامی است و عیناً برای دانشجو نمایش داده خواهد شد (حداقل ۵ کاراکتر)."
                : "A reason is required and will be communicated directly to the student (min 5 characters)."}
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.adminRequests.declineReasonLabel}
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                minLength={5}
                maxLength={500}
                placeholder={t.adminRequests.declineReasonPlaceholder}
                className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeclineModalSessionId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() =>
                  declineMutation.mutate({
                    sessionId: declineModalSessionId,
                    reason: declineReason,
                  })
                }
                disabled={declineMutation.isPending || declineReason.trim().length < 5}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition shadow-sm disabled:opacity-50"
              >
                {declineMutation.isPending ? t.adminRequests.declining : t.adminRequests.confirmDeclineBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
