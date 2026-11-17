"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "../providers";
import {
  formatToJalali,
  toPersianDigits,
  jalaliToIso,
  isoToJalali,
  getCalendarToday,
  getJalaliMonthGrid,
  getGregorianMonthGrid,
} from "@/lib/date-utils";
import { getTranslations } from "@/lib/translations";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  CalendarDays,
} from "lucide-react";

export interface DatePickerProps {
  value?: string; // Gregorian ISO string YYYY-MM-DD
  onChange: (value: string) => void;
  min?: string; // ISO string YYYY-MM-DD
  max?: string; // ISO string YYYY-MM-DD
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  allowClear?: boolean;
  calendarMode?: "jalali" | "gregorian"; // Optional override
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  placeholder,
  className = "",
  id,
  name,
  allowClear = true,
  calendarMode,
}: DatePickerProps) {
  const { lang, calendarType: authCalendarType } = useAuth();
  const t = getTranslations(lang);
  const containerRef = useRef<HTMLDivElement>(null);

  // Active calendar mode: Jalali when lang is Persian, Gregorian when lang is English
  const activeMode: "jalali" | "gregorian" =
    calendarMode || (lang === "fa" ? "jalali" : authCalendarType || "gregorian");

  const [isOpen, setIsOpen] = useState(false);

  // Today's dates
  const today = useMemo(() => getCalendarToday(), []);

  // View state: current year and month (0-11) shown in the calendar popover
  const [viewYear, setViewYear] = useState<number>(() => {
    if (value) {
      if (activeMode === "jalali") {
        return isoToJalali(value).year;
      } else {
        return parseInt(value.slice(0, 4), 10);
      }
    }
    return activeMode === "jalali" ? today.jalali.year : today.gregorian.year;
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value) {
      if (activeMode === "jalali") {
        return isoToJalali(value).month;
      } else {
        return parseInt(value.slice(5, 7), 10) - 1;
      }
    }
    return activeMode === "jalali" ? today.jalali.month : today.gregorian.month;
  });

  // Sync viewYear and viewMonth when value changes or mode switches
  useEffect(() => {
    if (value) {
      try {
        if (activeMode === "jalali") {
          const j = isoToJalali(value);
          setViewYear(j.year);
          setViewMonth(j.month);
        } else {
          setViewYear(parseInt(value.slice(0, 4), 10));
          setViewMonth(parseInt(value.slice(5, 7), 10) - 1);
        }
      } catch {
        // Fallback to today
      }
    }
  }, [value, activeMode]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Month and Day calculations
  const monthNames =
    activeMode === "jalali"
      ? t.datepicker.monthsJalali
      : t.datepicker.monthsGregorian;

  const weekdays = t.datepicker.weekdays;

  const monthGrid = useMemo(() => {
    if (activeMode === "jalali") {
      return getJalaliMonthGrid(viewYear, viewMonth);
    } else {
      return getGregorianMonthGrid(viewYear, viewMonth);
    }
  }, [activeMode, viewYear, viewMonth]);

  // Year options list for fast selection (span ±6 years around current view)
  const yearOptions = useMemo(() => {
    const currentBase =
      activeMode === "jalali" ? today.jalali.year : today.gregorian.year;
    const startYear = currentBase - 4;
    const endYear = currentBase + 6;
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    // Also include viewYear if outside window
    if (!years.includes(viewYear)) {
      years.push(viewYear);
      years.sort((a, b) => a - b);
    }
    return years;
  }, [activeMode, today, viewYear]);

  // Display value for the trigger input
  const displayValue = useMemo(() => {
    if (!value) return "";
    try {
      if (activeMode === "jalali") {
        return formatToJalali(value, "yyyy/MM/dd", true);
      }
      return value;
    } catch {
      return value;
    }
  }, [value, activeMode]);

  // Day selection handler
  const handleSelectDay = (isoDate: string) => {
    onChange(isoDate);
    setIsOpen(false);
  };

  // Select Today handler
  const handleSelectToday = () => {
    onChange(today.iso);
    if (activeMode === "jalali") {
      setViewYear(today.jalali.year);
      setViewMonth(today.jalali.month);
    } else {
      setViewYear(today.gregorian.year);
      setViewMonth(today.gregorian.month);
    }
    setIsOpen(false);
  };

  // Clear date handler
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const defaultPlaceholder = placeholder || t.datepicker.selectDate;

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      {/* Hidden input for HTML form submission compatibility */}
      {name && (
        <input
          type="hidden"
          id={id}
          name={name}
          value={value || ""}
          required={required}
        />
      )}

      {/* Trigger Button */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm rounded-xl border transition cursor-pointer select-none ${
          disabled
            ? "bg-slate-100 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
            : isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:border-slate-400 dark:hover:border-slate-600"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          {displayValue ? (
            <span className="font-semibold text-slate-900 dark:text-white font-mono">
              {displayValue}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-xs">
              {defaultPlaceholder}
            </span>
          )}
        </div>

        {allowClear && !disabled && value && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              title={t.datepicker.clear}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          dir={lang === "fa" ? "rtl" : "ltr"}
          className={`absolute z-50 mt-1.5 w-72 sm:w-80 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
            lang === "fa" ? "right-0" : "left-0"
          }`}
          style={{ minWidth: "280px" }}
        >
          {/* Calendar Mode & Month Navigation Header */}
          <div className="flex items-center justify-between gap-1 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            {/* Prev Month Button (taking direction into account) */}
            <button
              type="button"
              onClick={lang === "fa" ? handleNextMonth : handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition"
              title={lang === "fa" ? t.datepicker.nextMonth : t.datepicker.prevMonth}
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-0" />
            </button>

            {/* Month & Year Selectors */}
            <div className="flex items-center gap-1.5">
              {/* Month Dropdown */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-xs font-semibold px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white cursor-pointer focus:ring-1 focus:ring-blue-500"
              >
                {monthNames.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-xs font-semibold px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white cursor-pointer focus:ring-1 focus:ring-blue-500 font-mono"
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {activeMode === "jalali" ? toPersianDigits(yr) : yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Next Month Button */}
            <button
              type="button"
              onClick={lang === "fa" ? handlePrevMonth : handleNextMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition"
              title={lang === "fa" ? t.datepicker.prevMonth : t.datepicker.nextMonth}
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-0" />
            </button>
          </div>

          {/* Weekday Column Headers (Saturday to Friday) */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {weekdays.map((wName, idx) => {
              // idx 5 is Thu, idx 6 is Fri in Saturday-start week
              const isWeekendCol = idx === 5 || idx === 6;
              return (
                <span
                  key={idx}
                  className={`text-[11px] font-bold py-1 select-none ${
                    isWeekendCol
                      ? "text-rose-500/80 dark:text-rose-400/80"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {wName}
                </span>
              );
            })}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank leading cells */}
            {Array.from({ length: monthGrid.startCol }).map((_, i) => (
              <div key={`blank-${i}`} className="h-8 sm:h-9" />
            ))}

            {/* Active Month Days */}
            {monthGrid.days.map((dayItem) => {
              const isSelected = value === dayItem.isoDate;
              const isToday = today.iso === dayItem.isoDate;
              const isBeforeMin = min ? dayItem.isoDate < min : false;
              const isAfterMax = max ? dayItem.isoDate > max : false;
              const isDisabledDay = isBeforeMin || isAfterMax;

              return (
                <button
                  key={dayItem.isoDate}
                  type="button"
                  disabled={isDisabledDay}
                  onClick={() => handleSelectDay(dayItem.isoDate)}
                  className={`h-8 sm:h-9 w-full flex items-center justify-center text-xs sm:text-sm rounded-xl font-medium transition select-none font-mono ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
                      : isToday
                      ? "border border-blue-500 text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                      : isDisabledDay
                      ? "text-slate-300 dark:text-slate-600 cursor-not-allowed hover:bg-transparent"
                      : dayItem.isWeekend
                      ? "text-rose-600 dark:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  title={`${dayItem.isoDate} (${
                    activeMode === "jalali"
                      ? formatToJalali(dayItem.isoDate)
                      : dayItem.isoDate
                  })`}
                >
                  {activeMode === "jalali"
                    ? toPersianDigits(dayItem.dayNumber)
                    : dayItem.dayNumber}
                </button>
              );
            })}
          </div>

          {/* Footer Controls */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            {/* Quick Today Button */}
            <button
              type="button"
              onClick={handleSelectToday}
              className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline px-1.5 py-1 rounded"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{t.datepicker.today}</span>
            </button>

            <div className="flex items-center gap-2">
              {/* Clear button if value is selected */}
              {value && allowClear && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-1.5 py-1 rounded"
                >
                  {t.datepicker.clear}
                </button>
              )}

              {/* Close button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                {t.datepicker.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
