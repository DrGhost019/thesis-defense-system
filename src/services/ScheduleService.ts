import prisma from "@/lib/prisma";
import {
  getWeekSaturday,
  getWeekWorkingDays,
  expandSlotOccurrences,
  formatToJalali,
  toTehranDateString,
  getTehranDate,
} from "@/lib/date-utils";
import { chromium } from "playwright";
import logger from "@/lib/logger";
import fs from "fs";
import path from "path";

export interface ScheduleBlock {
  slot_id: number;
  owner_name: string;
  owner_type: "professor" | "committee";
  slot_type: "single" | "recurring";
  recurrence_pattern?: string | null;
  weekday?: string | null;
  start_time: string;
  end_time: string;
  date: string;
}

export interface DaySchedule {
  date: string;
  weekday: string;
  weekday_name_fa: string;
  weekday_name_en: string;
  blocks: ScheduleBlock[];
}

export interface WeeklyScheduleData {
  week_start_saturday: string;
  week_end_wednesday: string;
  days: DaySchedule[];
}

export class ScheduleService {
  /**
   * Builds weekly grid data for the week containing dateParam (YYYY-MM-DD)
   */
  public static async buildWeek(dateParam?: string): Promise<WeeklyScheduleData> {
    const targetDate = dateParam || toTehranDateString(getTehranDate());
    const saturdayStr = getWeekSaturday(targetDate);
    const workingDays = getWeekWorkingDays(saturdayStr);
    const wednesdayStr = workingDays[4].dateStr;

    // Fetch all available slots where owner is active
    const slots = await prisma.availabilitySlot.findMany({
      where: {
        status: "available",
        OR: [
          {
            professor: {
              user: { is_active: true },
            },
          },
          {
            committee: {
              is_active: true,
            },
          },
        ],
      },
      include: {
        professor: {
          include: {
            user: { select: { full_name: true } },
          },
        },
        committee: { select: { name: true } },
      },
    });

    const weekdayNamesFa: Record<string, string> = {
      sat: "شنبه",
      sun: "یکشنبه",
      mon: "دوشنبه",
      tue: "سه‌شنبه",
      wed: "چهارشنبه",
    };

    const weekdayNamesEn: Record<string, string> = {
      sat: "Saturday",
      sun: "Sunday",
      mon: "Monday",
      tue: "Tuesday",
      wed: "Wednesday",
    };

    const days: DaySchedule[] = workingDays.map((d) => ({
      date: d.dateStr,
      weekday: d.weekday,
      weekday_name_fa: weekdayNamesFa[d.weekday] || d.weekday,
      weekday_name_en: weekdayNamesEn[d.weekday] || d.weekday,
      blocks: [],
    }));

    for (const slot of slots) {
      const occurrences = expandSlotOccurrences(
        {
          slot_type: slot.slot_type,
          slot_date: slot.slot_date,
          recurrence_pattern: slot.recurrence_pattern,
          weekday: slot.weekday,
          valid_from: slot.valid_from,
          valid_until: slot.valid_until,
        },
        saturdayStr,
        wednesdayStr
      );

      const ownerName = slot.committee?.name || slot.professor?.user.full_name || "نامشخص";
      const ownerType = slot.committee_id ? "committee" : "professor";

      for (const occDate of occurrences) {
        const day = days.find((d) => d.date === occDate);
        if (day) {
          day.blocks.push({
            slot_id: slot.slot_id,
            owner_name: ownerName,
            owner_type: ownerType,
            slot_type: slot.slot_type,
            recurrence_pattern: slot.recurrence_pattern,
            weekday: slot.weekday,
            start_time: slot.start_time,
            end_time: slot.end_time,
            date: occDate,
          });
        }
      }
    }

    // Sort blocks in each day by start_time
    for (const day of days) {
      day.blocks.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }

    return {
      week_start_saturday: saturdayStr,
      week_end_wednesday: wednesdayStr,
      days,
    };
  }

  /**
   * Generates a Landscape A4 PDF of the weekly schedule using Playwright
   */
  public static async exportPdf(
    weekStart?: string,
    lang: "fa" | "en" = "fa",
    calendar: "jalali" | "gregorian" = "jalali"
  ): Promise<Buffer> {
    const schedule = await this.buildWeek(weekStart);
    const nowTehran = toTehranDateString(getTehranDate());
    const jalaliWeekStart = formatToJalali(schedule.week_start_saturday);
    const jalaliWeekEnd = formatToJalali(schedule.week_end_wednesday);

    const isEn = lang === "en";
    const isJalali = calendar === "jalali";
    const dir = isEn ? "ltr" : "rtl";

    const title = isEn
      ? "Thesis Defense Scheduling System"
      : "سامانه زمان‌بندی جلسات دفاع پایان‌نامه";

    const subtitle = isEn
      ? "Weekly Faculty & Evaluation Committees Availability Schedule"
      : "برنامه هفتگی حضور اساتید و هیئت‌های داوران";

    const weekRangeLabel = isEn
      ? isJalali
        ? `Week Range: ${jalaliWeekStart} to ${jalaliWeekEnd} (${schedule.week_start_saturday} to ${schedule.week_end_wednesday})`
        : `Week Range: ${schedule.week_start_saturday} to ${schedule.week_end_wednesday}`
      : `بازه هفته: ${jalaliWeekStart} الی ${jalaliWeekEnd} (میلادی: ${schedule.week_start_saturday} to ${schedule.week_end_wednesday})`;

    const generatedAtLabel = isEn
      ? `Generated: ${nowTehran}`
      : `زمان تولید: ${nowTehran}`;

    const legendSingle = isEn ? "Single Professor Slot" : "بازه تک‌جلسه استاد";
    const legendRecurring = isEn ? "Recurring Professor Slot" : "بازه تکرارشونده استاد";
    const legendCommittee = isEn ? "Evaluation Committee" : "هیئت داوران";
    const noSlotsText = isEn ? "No availability slots" : "بدون بازه آزاد";

    const logoPath = path.join(process.cwd(), "public/assets/uni.png");
    let logoBase64 = "";
    try {
      if (fs.existsSync(logoPath)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
      }
    } catch {
      // fallback
    }

    const fontPath = path.join(process.cwd(), "public/fonts/Vazirmatn-VariableFont_wght.ttf");
    let fontBase64 = "";
    try {
      if (fs.existsSync(fontPath)) {
        fontBase64 = `data:font/truetype;charset=utf-8;base64,${fs.readFileSync(fontPath).toString("base64")}`;
      }
    } catch {
      // fallback
    }

    // Build standalone HTML for Playwright rendering
    const html = `<!DOCTYPE html>
<html lang="${isEn ? "en" : "fa"}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    ${
      fontBase64
        ? `@font-face {
      font-family: 'Vazirmatn';
      src: url('${fontBase64}') format('truetype');
    }`
        : ""
    }
    body {
      font-family: ${isEn ? "'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Vazirmatn'" : "'Vazirmatn', sans-serif"};
      margin: 0;
      padding: 16px;
      color: #1e293b;
      direction: ${dir};
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #1b365d;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .logo-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-img {
      width: 50px;
      height: 50px;
      object-fit: contain;
    }
    .header-text h1 {
      margin: 0;
      font-size: 18px;
      color: #1b365d;
    }
    .header-text p {
      margin: 4px 0 0;
      font-size: 12px;
      color: #64748b;
    }
    .meta-info {
      text-align: ${isEn ? "right" : "left"};
      font-size: 11px;
      color: #64748b;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .grid-table th {
      background: #1b365d;
      color: white;
      padding: 8px 4px;
      font-size: 12px;
      text-align: center;
      border: 1px solid #0f172a;
    }
    .grid-table td {
      border: 1px solid #cbd5e1;
      vertical-align: top;
      padding: 6px;
      height: 90px;
      background: #f8fafc;
    }
    .block {
      margin-bottom: 6px;
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 11px;
      ${isEn ? "border-left: 3px solid #3b82f6;" : "border-right: 3px solid #3b82f6;"}
    }
    .block-single {
      background: #e0f2fe;
      ${isEn ? "border-left-color: #0284c7;" : "border-right-color: #0284c7;"}
      color: #0369a1;
    }
    .block-recurring {
      background: #fef3c7;
      ${isEn ? "border-left-color: #d97706;" : "border-right-color: #d97706;"}
      color: #b45309;
    }
    .block-committee {
      background: #f3e8ff;
      ${isEn ? "border-left-color: #9333ea;" : "border-right-color: #9333ea;"}
      color: #7e22ce;
    }
    .block-time {
      font-weight: bold;
      direction: ltr;
      display: inline-block;
      margin-bottom: 2px;
    }
    .block-owner {
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 9px;
      margin-top: 2px;
      background: rgba(0,0,0,0.06);
    }
    .legend {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      font-size: 11px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .legend-box {
      width: 14px;
      height: 14px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-title">
      ${logoBase64 ? `<img class="logo-img" src="${logoBase64}" alt="University Logo" />` : ""}
      <div class="header-text">
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
    </div>
    <div class="meta-info">
      <div>${weekRangeLabel}</div>
      <div>${generatedAtLabel}</div>
    </div>
  </div>

  <table class="grid-table">
    <thead>
      <tr>
        ${schedule.days
          .map(
            (d) => `<th>
            <div>${isEn ? d.weekday_name_en : d.weekday_name_fa}</div>
            <div style="font-size: 10px; opacity: 0.85;">${
              isJalali ? formatToJalali(d.date) : d.date
            }</div>
          </th>`
          )
          .join("")}
      </tr>
    </thead>
    <tbody>
      <tr>
        ${schedule.days
          .map((d) => {
            if (d.blocks.length === 0) {
              return `<td><div style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 24px;">${noSlotsText}</div></td>`;
            }
            const blocksHtml = d.blocks
              .map((b) => {
                const isSingle = b.slot_type === "single";
                const isCommittee = b.owner_type === "committee";
                const blockClass = isCommittee
                  ? "block-committee"
                  : isSingle
                  ? "block-single"
                  : "block-recurring";
                const typeLabel = isSingle
                  ? (isEn ? "Single Day" : "تک‌جلسه")
                  : b.recurrence_pattern === "even_days"
                  ? (isEn ? "Even Days" : "تکرار روزهای زوج")
                  : b.recurrence_pattern === "odd_days"
                  ? (isEn ? "Odd Days" : "تکرار روزهای فرد")
                  : (isEn ? "Weekly" : "تکرار هفتگی");

                return `<div class="block ${blockClass}">
                  <div class="block-time">${b.start_time} - ${b.end_time}</div>
                  <div class="block-owner">${b.owner_name}</div>
                  <span class="badge">${typeLabel}</span>
                </div>`;
              })
              .join("");
            return `<td>${blocksHtml}</td>`;
          })
          .join("")}
      </tr>
    </tbody>
  </table>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-box" style="background: #e0f2fe; border: 1px solid #0284c7;"></div>
      <span>${legendSingle}</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: #fef3c7; border: 1px solid #d97706;"></div>
      <span>${legendRecurring}</span>
    </div>
    <div class="legend-item">
      <div class="legend-box" style="background: #f3e8ff; border: 1px solid #9333ea;"></div>
      <span>${legendCommittee}</span>
    </div>
  </div>
</body>
</html>`;

    let browser;
    try {
      browser = await chromium.launch({
        executablePath: "/usr/bin/google-chrome-stable",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      });
      return Buffer.from(pdfBuffer);
    } catch (err: any) {
      logger.error({ err: err.message }, "Error generating schedule PDF via Playwright");
      throw err;
    } finally {
      if (browser) await browser.close();
    }
  }
}
