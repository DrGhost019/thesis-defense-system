import { format as formatJalali, parse as parseJalali, newDate as newJalaliDate } from "date-fns-jalali";
import { format as formatGregorian, parseISO, startOfDay, addDays, getDay, isAfter, isBefore, isEqual } from "date-fns";
import { Weekday, RecurrencePattern } from "@prisma/client";

export const WORKING_WEEKDAYS: Weekday[] = ["sat", "sun", "mon", "tue", "wed"];

// Map from JS getDay() (0 = Sun, 1 = Mon, ..., 6 = Sat) to Weekday enum
export const JS_DAY_TO_WEEKDAY: Record<number, Weekday | null> = {
  6: "sat",
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: null, // Thursday (weekend)
  5: null, // Friday (weekend)
};

export const WEEKDAY_TO_JS_DAY: Record<Weekday, number> = {
  sat: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
};

export const WEEKDAY_NAMES_FA: Record<Weekday, string> = {
  sat: "شنبه",
  sun: "یکشنبه",
  mon: "دوشنبه",
  tue: "سه‌شنبه",
  wed: "چهارشنبه",
};

export const WEEKDAY_NAMES_EN: Record<Weekday, string> = {
  sat: "Saturday",
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
};

/**
 * Returns Tehran current time components or creates a date in Asia/Tehran
 */
export function getTehranDate(date: Date = new Date()): Date {
  // Use Intl to get parts in Asia/Tehran
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  return new Date(Date.UTC(year, month, day, 0, 0, 0));
}

export function toTehranDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // YYYY-MM-DD
}

/**
 * Checks if a given YYYY-MM-DD is a working day (Saturday to Wednesday)
 */
export function isWorkingDay(dateStr: string): boolean {
  const d = parseISO(dateStr);
  const day = getDay(d);
  return JS_DAY_TO_WEEKDAY[day] !== null;
}

/**
 * Returns the Saturday of the week containing dateStr.
 * Week starts on Saturday (JS day 6).
 */
export function getWeekSaturday(dateStr: string): string {
  const d = parseISO(dateStr);
  const day = getDay(d); // 0=Sun..6=Sat
  // Days to subtract to get to preceding Saturday:
  // Sat (6) -> 0
  // Sun (0) -> 1
  // Mon (1) -> 2
  // Tue (2) -> 3
  // Wed (3) -> 4
  // Thu (4) -> 5
  // Fri (5) -> 6
  const daysSinceSaturday = (day + 1) % 7;
  const sat = addDays(d, -daysSinceSaturday);
  return formatGregorian(sat, "yyyy-MM-dd");
}

/**
 * Returns the 5 working dates of the week starting at saturdayDateStr: [Sat, Sun, Mon, Tue, Wed]
 */
export function getWeekWorkingDays(saturdayDateStr: string): { dateStr: string; weekday: Weekday }[] {
  const sat = parseISO(saturdayDateStr);
  return [0, 1, 2, 3, 4].map((offset) => {
    const cur = addDays(sat, offset);
    const dateStr = formatGregorian(cur, "yyyy-MM-dd");
    const day = getDay(cur);
    return {
      dateStr,
      weekday: JS_DAY_TO_WEEKDAY[day]!,
    };
  });
}

/**
 * Checks whether a recurring slot pattern matches a given JS day
 * Odd days: Saturday (6), Monday (1), Wednesday (3)
 * Even days: Sunday (0), Tuesday (2)
 * Weekly: exact weekday match
 */
export function slotMatchesDay(
  pattern: RecurrencePattern | null,
  weekday: Weekday | null,
  jsDay: number
): boolean {
  if (pattern === "odd_days") {
    return jsDay === 6 || jsDay === 1 || jsDay === 3;
  }
  if (pattern === "even_days") {
    return jsDay === 0 || jsDay === 2;
  }
  if (pattern === "weekly" && weekday) {
    return WEEKDAY_TO_JS_DAY[weekday] === jsDay;
  }
  return false;
}

/**
 * Expands a slot into concrete dates within a given date range [fromStr, toStr] (inclusive)
 */
export function expandSlotOccurrences(
  slot: {
    slot_type: "single" | "recurring";
    slot_date?: Date | string | null;
    recurrence_pattern?: RecurrencePattern | null;
    weekday?: Weekday | null;
    valid_from?: Date | string | null;
    valid_until?: Date | string | null;
  },
  fromStr: string,
  toStr: string
): string[] {
  const fromDate = parseISO(fromStr);
  const toDate = parseISO(toStr);

  if (slot.slot_type === "single" && slot.slot_date) {
    const dateStr = typeof slot.slot_date === "string" 
      ? slot.slot_date.slice(0, 10) 
      : formatGregorian(slot.slot_date, "yyyy-MM-dd");
    const d = parseISO(dateStr);
    if (!isBefore(d, fromDate) && !isAfter(d, toDate)) {
      return [dateStr];
    }
    return [];
  }

  if (slot.slot_type === "recurring" && slot.valid_from && slot.valid_until && slot.recurrence_pattern) {
    const vFromStr = typeof slot.valid_from === "string" ? slot.valid_from.slice(0, 10) : formatGregorian(slot.valid_from, "yyyy-MM-dd");
    const vUntilStr = typeof slot.valid_until === "string" ? slot.valid_until.slice(0, 10) : formatGregorian(slot.valid_until, "yyyy-MM-dd");
    const vFrom = parseISO(vFromStr);
    const vUntil = parseISO(vUntilStr);

    const actualStart = isAfter(fromDate, vFrom) ? fromDate : vFrom;
    const actualEnd = isBefore(toDate, vUntil) ? toDate : vUntil;

    if (isAfter(actualStart, actualEnd)) return [];

    const result: string[] = [];
    let cur = actualStart;
    while (!isAfter(cur, actualEnd)) {
      const jsDay = getDay(cur);
      if (JS_DAY_TO_WEEKDAY[jsDay] !== null) {
        if (slotMatchesDay(slot.recurrence_pattern, slot.weekday ?? null, jsDay)) {
          result.push(formatGregorian(cur, "yyyy-MM-dd"));
        }
      }
      cur = addDays(cur, 1);
    }
    return result;
  }

  return [];
}

/**
 * Checks if two half-open time intervals [start1, end1) and [start2, end2) overlap.
 * Touching intervals do not overlap.
 */
export function timeIntervalsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Validates slot times according to Appendix C.1 & Part E:
 * - 15-minute steps
 * - start >= 08:00
 * - end <= 17:00
 * - length 30 minutes to 4 hours
 */
export function validateSlotTimes(start: string, end: string): { valid: boolean; error?: string } {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(start) || !timeRegex.test(end)) {
    return { valid: false, error: "قالب زمان باید به صورت HH:MM باشد" };
  }

  const [sH, sM] = start.split(":").map(Number);
  const [eH, eM] = end.split(":").map(Number);

  if (sM % 15 !== 0 || eM % 15 !== 0) {
    return { valid: false, error: "زمان شروع و پایان باید در گام‌های ۱۵ دقیقه‌ای باشد" };
  }

  const startMinutes = sH * 60 + sM;
  const endMinutes = eH * 60 + eM;

  const minWorkingMinutes = 8 * 60; // 08:00
  const maxWorkingMinutes = 17 * 60; // 17:00

  if (startMinutes < minWorkingMinutes) {
    return { valid: false, error: "زمان شروع نمی‌تواند قبل از ساعت ۰۸:۰۰ باشد" };
  }
  if (endMinutes > maxWorkingMinutes) {
    return { valid: false, error: "زمان پایان نمی‌تواند بعد از ساعت ۱۷:۰۰ باشد" };
  }
  if (endMinutes <= startMinutes) {
    return { valid: false, error: "زمان پایان باید بعد از زمان شروع باشد" };
  }

  const lengthMinutes = endMinutes - startMinutes;
  if (lengthMinutes < 30) {
    return { valid: false, error: "طول بازه باید حداقل ۳۰ دقیقه باشد" };
  }
  if (lengthMinutes > 240) {
    return { valid: false, error: "طول بازه نمی‌تواند بیشتر از ۴ ساعت باشد" };
  }

  return { valid: true };
}

/**
 * Formats a Gregorian date (YYYY-MM-DD) into Jalali string (e.g. ۱۴۰۵/۰۸/۰۳)
 */
export function formatToJalali(dateStr: string, formatPattern: string = "yyyy/MM/dd"): string {
  try {
    const d = parseISO(dateStr);
    return formatJalali(d, formatPattern);
  } catch {
    return dateStr;
  }
}
