import { chromium } from "playwright";
import * as path from "path";

async function verifyPersianNumbers() {
  console.log("Starting verification of Persian vs English numerals...");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const artifactDir = "/home/drghost019/.gemini/antigravity/brain/a5b94596-d6b5-46ae-8003-ed8da8de84b5";

  // 1. Check Persian Mode
  console.log("\n=== Checking Persian Mode (Expect Persian Numbers) ===");
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

  // Check Dashboard Date text in Persian
  const faDateText = await page.locator("main .inline-flex.items-center").first().innerText();
  console.log(`Persian Dashboard Date Text: "${faDateText}"`);

  // Check if date contains Persian numerals
  const hasPersianDigits = /[\u06F0-\u06F9]/.test(faDateText);
  console.log(`Contains Persian Digits (۰-۹): ${hasPersianDigits}`);

  // Navigate to Weekly Schedule
  const scheduleTab = page.locator('nav button:has-text("برنامه هفتگی")').first();
  await scheduleTab.click();
  await page.waitForTimeout(800);

  const faScheduleHeader = await page.locator("main h2 + p").first().innerText();
  console.log(`Persian Schedule Header: "${faScheduleHeader}"`);
  console.log(`Schedule Header has Persian Digits: ${/[\u06F0-\u06F9]/.test(faScheduleHeader)}`);

  // Verify visual font rendering of numbers in slot cards
  const sampleSlotTime = page.locator("main td .font-mono").first();
  if (await sampleSlotTime.count()) {
    const timeText = await sampleSlotTime.innerText();
    console.log(`Slot Time text in DOM: "${timeText}"`);
    // Check computed CSS font-feature-settings
    const ffs = await sampleSlotTime.evaluate((el) => window.getComputedStyle(el).fontFeatureSettings);
    console.log(`Slot Time font-feature-settings: "${ffs}" (Expected: "ss01" 1)`);
  }

  await page.screenshot({ path: path.join(artifactDir, "ui_persian_numerals.png") });
  console.log("Saved ui_persian_numerals.png");

  // 2. Switch to English Mode
  console.log("\n=== Switching to English Mode (Expect English Numbers) ===");
  const langToggleBtn = page.locator('header button:has-text("English")').first();
  await langToggleBtn.click();
  await page.waitForTimeout(800);

  const enScheduleHeader = await page.locator("main h2 + p").first().innerText();
  console.log(`English Schedule Header: "${enScheduleHeader}"`);
  console.log(`English Schedule Header has Persian Digits: ${/[\u06F0-\u06F9]/.test(enScheduleHeader)} (Expected: false)`);
  console.log(`English Schedule Header has English Digits: ${/[0-9]/.test(enScheduleHeader)} (Expected: true)`);

  const enSampleSlotTime = page.locator("main td .font-mono").first();
  if (await enSampleSlotTime.count()) {
    const ffsEn = await enSampleSlotTime.evaluate((el) => window.getComputedStyle(el).fontFeatureSettings);
    console.log(`English Slot Time font-feature-settings: "${ffsEn}"`);
  }

  // Navigate to Dashboard
  const dashTabEn = page.locator('nav button:has-text("Dashboard")').first();
  await dashTabEn.click();
  await page.waitForTimeout(600);

  const enDateText = await page.locator("main .inline-flex.items-center").first().innerText();
  console.log(`English Dashboard Date Text: "${enDateText}"`);
  console.log(`English Date has Persian Digits: ${/[\u06F0-\u06F9]/.test(enDateText)} (Expected: false)`);
  console.log(`English Date has English Digits: ${/[0-9]/.test(enDateText)} (Expected: true)`);

  await page.screenshot({ path: path.join(artifactDir, "ui_english_numerals.png") });
  console.log("Saved ui_english_numerals.png");

  await browser.close();
  console.log("\nVerification of numbers completed successfully!");
}

verifyPersianNumbers().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
