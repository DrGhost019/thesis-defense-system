import { chromium } from "playwright";
import * as path from "path";

async function verifySelectionFlow() {
  console.log("Verifying Quick Test Account Selection & CAPTCHA flow...");
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const artifactDir = "/home/drghost019/.gemini/antigravity/brain/a5b94596-d6b5-46ae-8003-ed8da8de84b5";

  // Visit Login Page
  await page.goto("http://localhost:3000");
  await page.waitForTimeout(1000);

  // 1. Check initial username & password fields are empty
  const initialUsername = await page.locator('input[type="text"]').inputValue();
  const initialPassword = await page.locator('input[type="password"]').inputValue();
  console.log(`Initial input values: username="${initialUsername}", password="${initialPassword}"`);

  // 2. Click on "دکتر احمدی (استاد)" option
  console.log('Clicking on quick test account: "prof.ahmadi"...');
  const profAhmadiBtn = page.locator('button:has-text("دکتر احمدی")').first();
  await profAhmadiBtn.click();
  await page.waitForTimeout(400);

  // 3. Verify fields are automatically populated
  const populatedUsername = await page.locator('input[type="text"]').inputValue();
  const populatedPassword = await page.locator('input[type="password"]').inputValue();
  console.log(`Populated input values: username="${populatedUsername}", password="${populatedPassword}"`);
  console.log(`Auto-population verified: ${populatedUsername === "prof.ahmadi" && populatedPassword === "pass123456"}`);

  // 4. Verify we are still on the login page (not immediately logged in)
  const isStillOnLogin = await page.locator('h3:has-text("ورود به حساب کاربری دانشگاهی")').count();
  console.log(`Still on Login page (awaiting CAPTCHA): ${isStillOnLogin > 0}`);

  // 5. Try clicking "Sign In" before solving CAPTCHA
  console.log('Attempting to click "Sign In" before CAPTCHA verification...');
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(400);

  // Check error message
  const errorText = await page.locator(".bg-red-50").innerText();
  console.log(`Enforced CAPTCHA Warning Message: "${errorText.trim()}"`);

  // 6. Click on another option (e.g. "علی علوی") to test selection switching
  console.log('Clicking on quick test account: "student.alavi"...');
  const studentBtn = page.locator('button:has-text("علی علوی")').first();
  await studentBtn.click();
  await page.waitForTimeout(400);

  const studentUsername = await page.locator('input[type="text"]').inputValue();
  console.log(`Switched to student: username="${studentUsername}"`);

  await page.screenshot({ path: path.join(artifactDir, "ui_login_selection_flow.png") });
  console.log("Saved ui_login_selection_flow.png");

  await browser.close();
  console.log("\nFlow verification completed successfully!");
}

verifySelectionFlow().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
