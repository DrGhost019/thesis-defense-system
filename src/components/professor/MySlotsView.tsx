"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { formatToJalali } from "@/lib/date-utils";
import { getTranslations } from "@/lib/translations";
import {
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

export function MySlotsView() {
  const { lang, calendarType } = useAuth();
  const t = getTranslations(lang);
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [ownerType, setOwnerType] = useState<"professor" | "committee">("professor");
  const [committeeId, setCommitteeId] = useState<string>("");
  const [slotType, setSlotType] = useState<"single" | "recurring">("recurring");
  const [slotDate, setSlotDate] = useState<string>("");
  const [pattern, setPattern] = useState<"odd_days" | "even_days" | "weekly">("odd_days");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create slot");
      return data;
    },
    onSuccess: () => {
      setSuccessMessage(lang === "fa" ? "بازه زمانی با موفقیت ثبت شد" : "Availability slot created successfully");
      setErrorMessage(null);
      setIsFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-slots"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message);
      setSuccessMessage(null);
    },
  });

  const withdrawSlotMutation = useMutation({
    mutationFn: async (slotId: number) => {
      const res = await fetch(`/api/v1/slots/${slotId}/withdraw`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to withdraw slot");
      return data;
    },
    onSuccess: () => {
      setSuccessMessage(lang === "fa" ? "بازه با موفقیت لغو شد" : "Slot successfully withdrawn");
      queryClient.invalidateQueries({ queryKey: ["my-slots"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message);
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
            setSuccessMessage(null);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{isFormOpen ? t.slots.closeFormBtn : t.slots.newSlotBtn}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span>{errorMessage}</span>
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
                <input
                  type="date"
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  required
                  className="w-full p-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
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
                    <option value="odd_days">{t.slots.oddDaysPattern}</option>
                    <option value="even_days">{t.slots.evenDaysPattern}</option>
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
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    required
                    className="w-full p-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.slots.validUntilLabel}
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    required
                    className="w-full p-2 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
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
                          {slot.recurrence_pattern === "odd_days"
                            ? t.slots.oddDaysPattern
                            : slot.recurrence_pattern === "even_days"
                            ? t.slots.evenDaysPattern
                            : `${t.slots.weeklyPattern} (${slot.weekday})`}{" "}
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
                      if (
                        confirm(
                          lang === "fa"
                            ? "آیا از لغو این بازه زمانی مطمئن هستید؟ بازه از جدول حذف خواهد شد."
                            : "Are you sure you want to withdraw this availability slot?"
                        )
                      ) {
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
