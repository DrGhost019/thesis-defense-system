"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { formatToJalali, getWeekSaturday, toTehranDateString } from "@/lib/date-utils";
import { getTranslations } from "@/lib/translations";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Info,
  Clock,
  Users,
  User,
  Loader2,
} from "lucide-react";
import { addDays, parseISO, format as formatGregorian } from "date-fns";

export function WeeklyScheduleView() {
  const { user, lang, calendarType } = useAuth();
  const t = getTranslations(lang);

  const [currentWeekSaturday, setCurrentWeekSaturday] = useState<string>(() => {
    return getWeekSaturday(toTehranDateString(new Date()));
  });
  const [filterQuery, setFilterQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "professor" | "committee">("all");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["schedule", currentWeekSaturday],
    queryFn: async () => {
      const res = await fetch(`/api/v1/schedule?week=${currentWeekSaturday}`);
      if (!res.ok) throw new Error("Failed to load schedule");
      return res.json();
    },
  });

  const nextWeek = () => {
    const d = parseISO(currentWeekSaturday);
    const nextSat = addDays(d, 7);
    setCurrentWeekSaturday(formatGregorian(nextSat, "yyyy-MM-dd"));
  };

  const prevWeek = () => {
    const d = parseISO(currentWeekSaturday);
    const prevSat = addDays(d, -7);
    setCurrentWeekSaturday(formatGregorian(prevSat, "yyyy-MM-dd"));
  };

  const handleDownloadPdf = () => {
    window.open(`/api/v1/schedule.pdf?week=${currentWeekSaturday}`, "_blank");
  };

  const jalaliWeekStart = data?.week_start_saturday ? formatToJalali(data.week_start_saturday) : "";
  const jalaliWeekEnd = data?.week_end_wednesday ? formatToJalali(data.week_end_wednesday) : "";

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span>{t.schedule.title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {calendarType === "jalali" ? (
              <span>
                {t.schedule.week} {jalaliWeekStart} {t.schedule.to} {jalaliWeekEnd}
              </span>
            ) : (
              <span>
                {t.schedule.week} {data?.week_start_saturday} {t.schedule.to} {data?.week_end_wednesday}
              </span>
            )}
            <span className="text-slate-400 dark:text-slate-500 mx-2">
              {t.schedule.workingDaysNotice}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Week Selector DatePicker */}
          <div className="w-36 sm:w-44">
            <DatePicker
              value={currentWeekSaturday}
              onChange={(dateStr) => {
                if (dateStr) {
                  setCurrentWeekSaturday(getWeekSaturday(dateStr));
                }
              }}
              allowClear={false}
            />
          </div>

          {/* Week Navigation */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={prevWeek}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition"
              title={t.schedule.prevWeek}
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-0 rotate-180" />
            </button>
            <span className="px-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
              {calendarType === "jalali" ? jalaliWeekStart : currentWeekSaturday}
            </span>
            <button
              onClick={nextWeek}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition"
              title={t.schedule.nextWeek}
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-0 rotate-180" />
            </button>
          </div>

          {/* PDF Download Button */}
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>{t.schedule.downloadPdf}</span>
          </button>
        </div>
      </div>

      {/* Student notice banner (FR-20) */}
      {user?.role === "student" && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 flex items-start gap-3 text-xs sm:text-sm">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">{t.schedule.studentGuideTitle}</span>
            {t.schedule.studentGuideText}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-100/80 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="relative flex-1 w-full">
          <Filter className="w-4 h-4 text-slate-400 absolute right-3 rtl:right-3 ltr:right-auto ltr:left-3 top-2.5" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={t.schedule.searchPlaceholder}
            className="w-full rtl:pr-9 rtl:pl-3 ltr:pl-9 ltr:pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              filterType === "all"
                ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}
          >
            {t.schedule.filterAll}
          </button>
          <button
            onClick={() => setFilterType("professor")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              filterType === "professor"
                ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}
          >
            {t.schedule.filterProfessors}
          </button>
          <button
            onClick={() => setFilterType("committee")}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              filterType === "committee"
                ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm font-bold"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50"
            }`}
          >
            {t.schedule.filterCommittees}
          </button>
        </div>
      </div>

      {/* Grid Container */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.schedule.loading}</p>
        </div>
      ) : isError ? (
        <div className="bg-red-50 dark:bg-red-950/40 rounded-2xl p-8 text-center border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
          <p className="font-bold">{t.schedule.errorLoading}</p>
          <button
            onClick={() => refetch()}
            className="mt-3 px-4 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition"
          >
            {t.common.retry}
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Legend */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-sky-100 border border-sky-400"></span>
              <span>{t.schedule.legendSingleProf}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-400"></span>
              <span>{t.schedule.legendRecurringProf}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-purple-100 border border-purple-400"></span>
              <span>{t.schedule.legendCommittee}</span>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-900 dark:bg-slate-950 text-white text-xs">
                  {data?.days.map((day: any) => (
                    <th
                      key={day.date}
                      className="p-3 border-r border-slate-800 last:border-r-0 text-center font-bold"
                    >
                      <div className="text-sm">
                        {lang === "fa" ? day.weekday_name_fa : day.weekday_name_en}
                      </div>
                      <div className="text-[11px] font-normal text-slate-300 mt-0.5">
                        {calendarType === "jalali" ? formatToJalali(day.date) : day.date}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <tr>
                  {data?.days.map((day: any) => {
                    const filteredBlocks = day.blocks.filter((b: any) => {
                      if (filterType !== "all" && b.owner_type !== filterType) return false;
                      if (filterQuery.trim()) {
                        return b.owner_name
                          .toLowerCase()
                          .includes(filterQuery.trim().toLowerCase());
                      }
                      return true;
                    });

                    return (
                      <td
                        key={day.date}
                        className="p-3 align-top border-r border-slate-200 dark:border-slate-800 last:border-r-0 bg-slate-50/50 dark:bg-slate-900/50 min-h-[350px] w-1/5"
                      >
                        {filteredBlocks.length === 0 ? (
                          <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs italic">
                            {t.schedule.noSlots}
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {filteredBlocks.map((block: any, idx: number) => {
                              const isSingle = block.slot_type === "single";
                              const isCommittee = block.owner_type === "committee";
                              let cardColor =
                                "bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200";
                              let badgeColor = "bg-sky-200/70 dark:bg-sky-900/80 text-sky-800 dark:text-sky-200";

                              if (isCommittee) {
                                cardColor =
                                  "bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200";
                                badgeColor = "bg-purple-200/70 dark:bg-purple-900/80 text-purple-800 dark:text-purple-200";
                              } else if (!isSingle) {
                                cardColor =
                                  "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200";
                                badgeColor = "bg-amber-200/70 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200";
                              }

                              const patternLabel = isSingle
                                ? t.schedule.single
                                : block.recurrence_pattern === "odd_days"
                                ? t.schedule.oddDays
                                : block.recurrence_pattern === "even_days"
                                ? t.schedule.evenDays
                                : t.schedule.weekly;

                              return (
                                <div
                                  key={`${block.slot_id}_${idx}`}
                                  className={`p-2.5 rounded-xl border shadow-sm transition hover:shadow-md ${cardColor}`}
                                >
                                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                                    <span
                                      className="flex items-center gap-1 font-mono tracking-tight"
                                      dir="ltr"
                                    >
                                      <Clock className="w-3 h-3 text-slate-500" />
                                      {block.start_time} - {block.end_time}
                                    </span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${badgeColor}`}
                                    >
                                      {patternLabel}
                                    </span>
                                  </div>
                                  <div className="text-xs font-semibold flex items-center gap-1">
                                    {isCommittee ? (
                                      <Users className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                                    ) : (
                                      <User className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                    )}
                                    <span className="truncate">{block.owner_name}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
