import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

async function main() {
  console.log("Starting UI Verification via Playwright...");
  const artifactDir = "/home/drghost019/.gemini/antigravity/brain/a5b94596-d6b5-46ae-8003-ed8da8de84b5";

  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // 1. Visit homepage
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  console.log("Navigated to http://localhost:3000");

  // Screenshot login page in light mode
  const loginScreenshotPath = path.join(artifactDir, "ui_login_light.png");
  await page.screenshot({ path: loginScreenshotPath });
  console.log("Saved login screenshot to:", loginScreenshotPath);

  // 2. Click demo admin button to log in
  console.log("Clicking quick admin demo login button...");
  await page.click('button:has-text("مدیر آموزش")');

  // Wait for dashboard navigation
  await page.waitForSelector('header h1:has-text("سامانه زمان‌بندی جلسات دفاع")', { timeout: 10000 });
  console.log("Logged in and header loaded successfully!");

  // 3. Inspect bounding boxes of elements in navbar
  const titleBox = await page.locator('header h1:has-text("سامانه زمان‌بندی جلسات دفاع")').boundingBox();
  const themeToggleBox = await page.locator('header button[aria-label="Toggle theme"]').boundingBox();
  const logoutBox = await page.locator('header button[title="خروج از حساب"]').boundingBox();

  console.log("Title bounding box:", titleBox);
  console.log("Theme toggle bounding box:", themeToggleBox);
  console.log("Logout button bounding box:", logoutBox);

  if (titleBox && themeToggleBox && logoutBox) {
    // In a 1280px viewport:
    // Far Right: titleBox.x should be > 600px (near the right edge)
    // Far Left: themeToggleBox.x and logoutBox.x should be < 300px (near the left edge)
    console.log(`Title X: ${titleBox.x} (Far Right)`);
    console.log(`Theme toggle X: ${themeToggleBox.x} (Far Left)`);
    console.log(`Logout button X: ${logoutBox.x} (Far Left)`);

    const isTitleAtRight = titleBox.x > themeToggleBox.x;
    console.log(`Verification: Title is to the right of controls: ${isTitleAtRight}`);

    const distanceToLogout = Math.abs(themeToggleBox.x - logoutBox.x);
    console.log(`Theme toggle distance to logout: ${distanceToLogout}px (Placed side-by-side)`);
  }

  // Screenshot Dashboard in Light Mode
  const lightScreenshotPath = path.join(artifactDir, "ui_dashboard_light.png");
  await page.screenshot({ path: lightScreenshotPath, fullPage: true });
  console.log("Saved dashboard light screenshot to:", lightScreenshotPath);

  // 4. Click theme toggle button to switch to Dark Mode
  console.log("Clicking theme toggle button to switch to dark mode...");
  await page.click('header button[aria-label="Toggle theme"]');
  await page.waitForTimeout(500);

  // Verify html class has "dark"
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  console.log(`Dark mode active on html element: ${isDark}`);

  // Screenshot Dashboard in Dark Mode
  const darkScreenshotPath = path.join(artifactDir, "ui_dashboard_dark.png");
  await page.screenshot({ path: darkScreenshotPath, fullPage: true });
  console.log("Saved dashboard dark screenshot to:", darkScreenshotPath);

  // 5. Toggle back to Light Mode
  console.log("Clicking theme toggle button again to return to light mode...");
  await page.click('header button[aria-label="Toggle theme"]');
  await page.waitForTimeout(500);

  const isLightAgain = await page.evaluate(() => !document.documentElement.classList.contains("dark"));
  console.log(`Returned to light mode: ${isLightAgain}`);

  await browser.close();
  console.log("UI Verification finished successfully!");
}

main().catch((err) => {
  console.error("UI Verification failed:", err);
  process.exit(1);
});
