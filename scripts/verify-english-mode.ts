import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const persianRegex = /[\u0600-\u06FF]/;

async function runVerification() {
  console.log("Launching Chromium headless for English localization verification...");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  const artifactDir = "/home/drghost019/.gemini/antigravity/brain/a5b94596-d6b5-46ae-8003-ed8da8de84b5";

  // 1. Visit Login Page with lang="en" in localStorage
  console.log("Checking Login page with English mode...");
  await page.goto("http://localhost:3000");
  await page.evaluate(() => {
    localStorage.setItem("app_lang", "en");
    localStorage.setItem("app_theme", "light");
  });
  await page.reload();
  await page.waitForTimeout(500);

  const loginTitle = await page.textContent("h2");
  console.log(`Login Title: "${loginTitle?.trim()}"`);

  // Verify English elements on login page
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log("Sample Login Page Text:\n", pageText.slice(0, 300));

  await page.screenshot({ path: path.join(artifactDir, "ui_login_en.png") });
  console.log("Saved ui_login_en.png");

  // 2. Perform Login as Admin
  console.log("Logging in as Admin in English mode...");
  // Click Quick Demo Admin button
  const adminBtn = page.locator('button:has-text("Admin")').first();
  await adminBtn.click();
  await page.waitForTimeout(1000);

  // Verify we are on Dashboard
  const brandTitle = await page.locator("header h1").textContent();
  console.log(`Header Brand Title: "${brandTitle?.trim()}"`);

  const dashboardWelcome = await page.locator("main h2").first().textContent();
  console.log(`Dashboard Welcome: "${dashboardWelcome?.trim()}"`);

  await page.screenshot({ path: path.join(artifactDir, "ui_dashboard_en.png") });
  console.log("Saved ui_dashboard_en.png");

  // Check tab switching and scan for Persian characters in each view
  const tabs = [
    { name: "Defense Requests", label: "Defense Requests" },
    { name: "Weekly Schedule", label: "Weekly Schedule" },
    { name: "Committees", label: "Committees" },
    { name: "User Accounts", label: "User Accounts" },
    { name: "Bale Reports", label: "Bale Reports" },
    { name: "Account Settings", label: "Account Settings" },
  ];

  for (const tab of tabs) {
    console.log(`\nNavigating to tab: "${tab.name}"...`);
    const tabBtn = page.locator(`nav button:has-text("${tab.label}")`).first();
    if (await tabBtn.count()) {
      await tabBtn.click();
      await page.waitForTimeout(600);

      const mainText = await page.locator("main").innerText();
      const lines = mainText.split("\n").map(l => l.trim()).filter(Boolean);
      
      const persianLines: string[] = [];
      for (const line of lines) {
        // Exclude user names/specific Persian seed entity data if any (e.g. thesis title of student)
        // Check for UI text
        if (persianRegex.test(line)) {
          persianLines.push(line);
        }
      }

      console.log(`Tab "${tab.name}" - Persian lines found: ${persianLines.length}`);
      if (persianLines.length > 0) {
        console.log("  Sample lines with Persian:", persianLines.slice(0, 5));
      }

      if (tab.name === "Weekly Schedule") {
        await page.screenshot({ path: path.join(artifactDir, "ui_schedule_en.png") });
        console.log("Saved ui_schedule_en.png");
      }
      if (tab.name === "Account Settings") {
        await page.screenshot({ path: path.join(artifactDir, "ui_profile_en.png") });
        console.log("Saved ui_profile_en.png");
      }
    } else {
      console.log(`Could not find nav button for "${tab.label}"`);
    }
  }

  // 3. Log out and log in as Student to check Student views
  console.log("\nLogging out and logging in as Student in English mode...");
  await page.evaluate(async () => {
    localStorage.removeItem("token");
    await fetch("/api/v1/auth/logout", { method: "POST" });
  });
  await page.goto("http://localhost:3000");
  await page.waitForTimeout(1000);

  const studentBtn = page.locator('button:has-text("Ali Alavi")').first();
  await studentBtn.waitFor({ state: "visible", timeout: 5000 });
  await studentBtn.click();
  await page.waitForTimeout(1000);

  const studentTab = page.locator('nav button:has-text("My Request")').first();
  if (await studentTab.count()) {
    await studentTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(artifactDir, "ui_student_en.png") });
    console.log("Saved ui_student_en.png");

    const studentMainText = await page.locator("main").innerText();
    const lines = studentMainText.split("\n").map((l) => l.trim()).filter(Boolean);
    console.log("Student View Sample Lines:", lines.slice(0, 10));
  }

  // 4. Log out and log in as Professor to check Professor views
  console.log("\nLogging out and logging in as Professor in English mode...");
  await page.evaluate(async () => {
    localStorage.removeItem("token");
    await fetch("/api/v1/auth/logout", { method: "POST" });
  });
  await page.goto("http://localhost:3000");
  await page.waitForTimeout(1000);

  const profBtn = page.locator('button:has-text("Dr. Ahmadi")').first();
  await profBtn.waitFor({ state: "visible", timeout: 5000 });
  await profBtn.click();
  await page.waitForTimeout(1000);

  const slotsTab = page.locator('nav button:has-text("My Slots")').first();
  if (await slotsTab.count()) {
    await slotsTab.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(artifactDir, "ui_professor_en.png") });
    console.log("Saved ui_professor_en.png");

    const profMainText = await page.locator("main").innerText();
    const lines = profMainText.split("\n").map((l) => l.trim()).filter(Boolean);
    console.log("Professor View Sample Lines:", lines.slice(0, 10));
  }

  await browser.close();
  console.log("\nVerification completed successfully!");
}

runVerification().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
