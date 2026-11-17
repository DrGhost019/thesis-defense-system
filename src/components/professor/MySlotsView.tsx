"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { formatToJalali } from "@/lib/date-utils";
import { getTranslations } from "@/lib/translations";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";

export function MySlotsView() {
  const { lang, calendarType } = useAuth();
  const t = getTranslations(lang);
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<"created" | "withdrawn" | null>(null);

  // Auto-dismiss notification banners after 5 seconds
  useEffect(() => {
    if (successKey) {
      const timer = setTimeout(() => {
        setSuccessKey(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successKey]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const parseErrorMessage = (err: any): string => {
    const raw = typeof err === "string" ? err : err?.message || "";

    if (
      raw.includes("هم‌پوشانی") ||
      raw.includes("SLOT_OVERLAP") ||
      raw.includes("overlap") ||
      raw.includes("CONFLICT")
    ) {
      return t.slots.overlapError;
    }
    if (
      raw.includes("روزهای کاری") ||
      raw.includes("working day") ||
      raw.includes("شنبه تا چهارشنبه")
    ) {
      return t.slots.workingDayError;
    }
    if (raw.includes("قبل از ساعت ۰۸:۰۰") || raw.includes("before 08:00")) {
      return t.slots.startTimeMinError;
    }
    if (raw.includes("بعد از ساعت ۱۷:۰۰") || raw.includes("after 17:00")) {
      return t.slots.endTimeMaxError;
    }
    if (raw.includes("گام‌های ۱۵ دقیقه‌ای") || raw.includes("15-minute")) {
      return t.slots.timeStepError;
    }
    if (raw.includes("بعد از زمان شروع") || raw.includes("after start time")) {
      return t.slots.timeOrderError;
    }
    if (raw.includes("حداقل ۳۰ دقیقه") || raw.includes("at least 30 minutes")) {
      return t.slots.minDurationError;
    }
    if (raw.includes("بیشتر از ۴ ساعت") || raw.includes("exceed 4 hours")) {
      return t.slots.maxDurationError;
    }
    if (raw.includes("در گذشته") || raw.includes("in the past")) {
      return t.slots.pastDateError;
    }
    if (
      raw.includes("عضو این هیئت") ||
      raw.includes("هیئت غیرفعال") ||
      raw.includes("not a member")
    ) {
      return t.slots.notCommitteeMemberError;
    }
    if (raw.includes("الزامی") || raw.includes("required")) {
      return t.slots.requiredFieldsError;
    }
    if (raw.includes("قبل از تاریخ شروع") || raw.includes("before start date")) {
      return t.slots.invalidDateRangeError;
    }
    if (raw.includes("۱۲ ماه") || raw.includes("12 months") || raw.includes("exceed 12 months")) {
      return t.slots.maxValidityError;
    }
    if (raw.includes("هیچ روز کاری") || raw.includes("no working days")) {
      return t.slots.noMatchingDaysError;
    }
    if (raw.includes("یافت نشد") || raw.includes("NOT_FOUND") || raw.includes("not found")) {
      return t.slots.slotNotFoundError;
    }
    if (
      raw.includes("اجازه") ||
      raw.includes("FORBIDDEN") ||
      raw.includes("authorized") ||
      raw.includes("فقط اساتید")
    ) {
      return t.slots.withdrawForbiddenError;
    }

    if (lang === "en" && /[\u0600-\u06FF]/.test(raw)) {
      return t.slots.genericError;
    }

    return raw || t.slots.genericError;
  };

  // Form state
  const [ownerType, setOwnerType] = useState<"professor" | "committee">("professor");
  const [committeeId, setCommitteeId] = useState<string>("");
  const [slotType, setSlotType] = useState<"single" | "recurring">("recurring");
  const [slotDate, setSlotDate] = useState<string>("");
  const [pattern, setPattern] = useState<"odd_days" | "even_days" | "weekly">("even_days");
  const [weekday, setWeekday] = useState<"sat" | "sun" | "mon" | "tue" | "wed">("sat");
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("11:00");
  const [validFrom, setValidFrom] = useState<string>("2026-10-24");
  const [validUntil, setValidUntil] = useState<string>("2026-12-31");

  // Fetch own slots
  const { data: slotsData, isLoading: slotsLoading } = useQuery({
    queryKey: ["my-slots"],
    queryFn: async () => {
      const res = await fetch("/api/v1/slots/mine");
      if (!res.ok) throw new Error("Failed to load slots");
      return res.json();
    },
  });

  // Fetch committees this professor belongs to
  const { data: commData } = useQuery({
    queryKey: ["my-committees"],
    queryFn: async () => {
      const res = await fetch("/api/v1/committees");
      if (!res.ok) throw new Error("Failed to load committees");
      return res.json();
    },
  });

  const createSlotMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/v1/slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": lang,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create slot");
      return data;
    },
    onSuccess: () => {
      setSuccessKey("created");
      setErrorMessage(null);
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-slots"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (err: any) => {
      setErrorMessage(parseErrorMessage(err));
      setSuccessKey(null);
    },
  });

  const withdrawSlotMutation = useMutation({
    mutationFn: async (slotId: number) => {
      const res = await fetch(`/api/v1/slots/${slotId}/withdraw`, {
        method: "POST",
        headers: {
          "Accept-Language": lang,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to withdraw slot");
      return data;
    },
    onSuccess: () => {
      setSuccessKey("withdrawn");
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ["my-slots"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (err: any) => {
      setErrorMessage(parseErrorMessage(err));
      setSuccessKey(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const payload: any = {
      owner_type: ownerType,
      committee_id: ownerType === "committee" ? parseInt(committeeId, 10) : undefined,
      slot_type: slotType,
      start_time: startTime,
      end_time: endTime,
    };

    if (slotType === "single") {
      payload.slot_date = slotDate;
    } else {
      payload.recurrence_pattern = pattern;
      payload.valid_from = validFrom;
      payload.valid_until = validUntil;
      if (pattern === "weekly") {
        payload.weekday = weekday;
      }
    }

    createSlotMutation.mutate(payload);
  };

  const slots: any[] = slotsData?.slots || [];
  const committees: any[] = commData?.committees || [];

  return (
    <div className="space-y-6">
      {/* Header and Toggle Form Button */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span>{t.slots.title}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.slots.desc}
          </p>
        </div>

        <button
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            setErrorMessage(null);
            setSuccessKey(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{isFormOpen ? t.slots.closeFormBtn : t.slots.newSlotBtn}</span>
        </button>
      </div>

      {successKey && (
        <div
          dir={lang === "fa" ? "rtl" : "ltr"}
          className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center justify-between gap-2 animate-in fade-in text-left rtl:text-right"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span className="text-left rtl:text-right">
              {successKey === "created"
                ? t.slots.createSuccess
                : successKey === "withdrawn"
                ? t.slots.withdrawSuccess
                : t.common.success}
            </span>
          </div>
          <button
            onClick={() => setSuccessKey(null)}
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
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
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

      {/* Define Slot Form Modal / Accordion */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg space-y-4 animate-in fade-in"
        >
          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            {t.slots.formTitle}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Owner type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.slots.ownerTypeLabel}
              </label>
              <select
                value={ownerType}
                onChange={(e) => setOwnerType(e.target.value as any)}
                className="w-full p-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="professor">{t.slots.personalProf}</option>
                <option value="committee">{t.slots.committeeOwner}</option>
              </select>
            </div>

            {/* Committee Selection if committee */}
            {ownerType === "committee" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.slots.selectCommittee}
                </label>
                <select
                  value={committeeId}
                  onChange={(e) => setCommitteeId(e.target.value)}
                  required
                  className="w-full p-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">-- {t.slots.selectCommittee} --</option>
                  {committees.map((c: any) => (
                    <option key={c.committee_id} value={c.committee_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Slot Type: Single vs Recurring */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.slots.slotTypeLabel}
              </label>
              <select
                value={slotType}
                onChange={(e) => setSlotType(e.target.value as any)}
                className="w-full p-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="recurring">{t.slots.recurringType}</option>
                <option value="single">{t.slots.singleType}</option>
              </select>
            </div>

            {/* If Single: date */}
            {slotType === "single" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.slots.singleDateLabel}
                </label>
                <DatePicker
                  value={slotDate}
                  onChange={setSlotDate}
                  required
                />
              </div>
            ) : (
              <>
                {/* Recurring Pattern */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.slots.patternLabel}
                  </label>
                  <select
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value as any)}
                    className="w-full p-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="even_days">{t.slots.evenDaysPattern}</option>
                    <option value="odd_days">{t.slots.oddDaysPattern}</option>
                    <option value="weekly">{t.slots.weeklyPattern}</option>
                  </select>
                </div>

                {pattern === "weekly" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.slots.weekdayLabel}
                    </label>
                    <select
                      value={weekday}
                      onChange={(e) => setWeekday(e.target.value as any)}
                      className="w-full p-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="sat">{t.schedule.days.sat}</option>
                      <option value="sun">{t.schedule.days.sun}</option>
                      <option value="mon">{t.schedule.days.mon}</option>
                      <option value="tue">{t.schedule.days.tue}</option>
                      <option value="wed">{t.schedule.days.wed}</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.slots.validFromLabel}
                  </label>
                  <DatePicker
                    value={validFrom}
                    onChange={setValidFrom}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.slots.validUntilLabel}
                  </label>
                  <DatePicker
                    value={validUntil}
                    onChange={setValidUntil}
                    min={validFrom || undefined}
                    required
                  />
                </div>
              </>
            )}

            {/* Time range */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.slots.startTimeLabel}
              </label>
              <input
                type="time"
                step={900}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full p-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.slots.endTimeLabel}
              </label>
              <input
                type="time"
                step={900}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full p-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={createSlotMutation.isPending}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
            >
              {createSlotMutation.isPending ? t.slots.creatingSlot : t.slots.createSlotBtn}
            </button>
          </div>
        </form>
      )}

      {/* Slots List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
          {t.slots.myDefinedSlots}
        </h3>

        {slotsLoading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <span>{t.common.loading}</span>
          </div>
        ) : slots.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            {t.slots.noSlotsDefined}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {slots.map((slot: any) => {
              const isSingle = slot.slot_type === "single";
              const isCommittee = !!slot.committee_id;
              const ownerName = slot.committee?.name || slot.professor?.user?.full_name;

              return (
                <div
                  key={slot.slot_id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {ownerName}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isCommittee
                            ? "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300"
                            : isSingle
                            ? "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300"
                            : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {isCommittee
                          ? t.slots.committeeOwner
                          : isSingle
                          ? t.slots.singleType
                          : t.slots.recurringType}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400">
                      <span className="font-mono" dir="ltr">
                        {slot.start_time} - {slot.end_time}
                      </span>

                      {isSingle ? (
                        <span>
                          {t.common.date}:{" "}
                          {calendarType === "jalali"
                            ? formatToJalali(slot.slot_date.slice(0, 10))
                            : slot.slot_date.slice(0, 10)}
                        </span>
                      ) : (
                        <span>
                          {t.slots.patternLabel}{" "}
                          {slot.recurrence_pattern === "even_days"
                            ? t.slots.evenDaysPattern
                            : slot.recurrence_pattern === "odd_days"
                            ? t.slots.oddDaysPattern
                            : `${t.slots.weeklyPattern} (${t.schedule.days[slot.weekday as keyof typeof t.schedule.days] || slot.weekday})`}{" "}
                          ({lang === "fa" ? "از" : "from"}{" "}
                          {calendarType === "jalali"
                            ? formatToJalali(slot.valid_from.slice(0, 10))
                            : slot.valid_from.slice(0, 10)}{" "}
                          {t.schedule.to}{" "}
                          {calendarType === "jalali"
                            ? formatToJalali(slot.valid_until.slice(0, 10))
                            : slot.valid_until.slice(0, 10)})
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(t.slots.confirmWithdraw)) {
                        withdrawSlotMutation.mutate(slot.slot_id);
                      }
                    }}
                    disabled={withdrawSlotMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-semibold self-start sm:self-auto transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.slots.withdrawBtn}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
