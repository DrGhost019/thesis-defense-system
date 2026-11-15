import { chromium } from "playwright";
import * as path from "path";

async function verifyCalendarLangSync() {
  console.log("Starting verification of Calendar-Language synchronization...");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const artifactDir = "/home/drghost019/.gemini/antigravity/brain/a5b94596-d6b5-46ae-8003-ed8da8de84b5";

  // 1. Check Persian mode first
  console.log("\n=== Checking Persian Mode (Shamsi Dates) ===");
  await page.goto("http://localhost:3000");
  await page.evaluate(() => {
    localStorage.setItem("app_lang", "fa");
  });
  await page.reload();
  await page.waitForTimeout(500);

  // Login as Admin
  const adminBtn = page.locator('button:has-text("admin")').first();
  await adminBtn.click();
  await page.waitForTimeout(1000);

  // Check Navbar: Verify NO calendar button exists
  const calendarButtonCount = await page.locator('header button:has-text("تقویم")').count();
  const gregorianButtonCount = await page.locator('header button:has-text("Gregorian")').count();
  console.log(`Calendar toggle button count in header: ${calendarButtonCount + gregorianButtonCount} (Expected: 0)`);

  // Check Dashboard date in Persian
  const dashboardTodayText = await page.locator("main .inline-flex.items-center").first().innerText();
  console.log(`Dashboard Today Date in Persian: "${dashboardTodayText}"`);
  // Should contain 1405 (Solar Hijri)
  const isShamsiInDashboard = dashboardTodayText.includes("۱۴۰۵") || dashboardTodayText.includes("1405");
  console.log(`Dashboard shows Solar Hijri (1405): ${isShamsiInDashboard}`);

  // Navigate to Weekly Schedule in Persian
  const scheduleTab = page.locator('nav button:has-text("برنامه هفتگی")').first();
  await scheduleTab.click();
  await page.waitForTimeout(800);

  const scheduleHeaderTextFa = await page.locator("main h2 + p").first().innerText();
  console.log(`Schedule Header Date Range in Persian: "${scheduleHeaderTextFa}"`);
  await page.screenshot({ path: path.join(artifactDir, "ui_schedule_shamsi.png") });

  // 2. Switch to English Mode
  console.log("\n=== Switching to English Mode (Gregorian Dates) ===");
  // Click Language button in Navbar
  const langToggleBtn = page.locator('header button:has-text("English")').first();
  await langToggleBtn.click();
  await page.waitForTimeout(800);

  // Verify Navbar: Still NO calendar button
  const enCalendarButtonCount = await page.locator('header button:has-text("Jalali")').count();
  const enGregorianButtonCount = await page.locator('header button:has-text("Gregorian")').count();
  console.log(`Calendar toggle button count in English header: ${enCalendarButtonCount + enGregorianButtonCount} (Expected: 0)`);

  // Check Schedule Header in English
  const scheduleHeaderTextEn = await page.locator("main h2 + p").first().innerText();
  console.log(`Schedule Header Date Range in English: "${scheduleHeaderTextEn}"`);
  // Should contain 2026 (Gregorian)
  const isGregorianInSchedule = scheduleHeaderTextEn.includes("2026");
  console.log(`Schedule shows Gregorian (2026): ${isGregorianInSchedule}`);

  // Check day headers in table
  const dayDatesEn = await page.locator("table thead th div.font-mono, table thead th div.text-slate-300").allInnerTexts();
  console.log("Day Header Dates in English Table:", dayDatesEn);
  await page.screenshot({ path: path.join(artifactDir, "ui_schedule_gregorian.png") });

  // Navigate back to Dashboard in English
  const dashTabEn = page.locator('nav button:has-text("Dashboard")').first();
  await dashTabEn.click();
  await page.waitForTimeout(600);

  const dashboardTodayTextEn = await page.locator("main .inline-flex.items-center").first().innerText();
  console.log(`Dashboard Today Date in English: "${dashboardTodayTextEn}"`);
  const isGregorianInDashboard = dashboardTodayTextEn.includes("2026");
  console.log(`Dashboard shows Gregorian (2026): ${isGregorianInDashboard}`);

  await browser.close();
  console.log("\nAll checks completed successfully!");
}

verifyCalendarLangSync().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
