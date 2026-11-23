import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = "/Users/jashwath/.gemini/antigravity/brain/1493e1c1-1b10-41fd-9bf8-0bc68baf872c/screenshots";
const BASE_URL = "http://localhost:3000";

const VIEWPORTS = [
  { name: "mobile_375x812", width: 375, height: 812 },
  { name: "mobile_430x932", width: 430, height: 932 },
  { name: "tablet_768x1024", width: 768, height: 1024 },
  { name: "laptop_1440x900", width: 1440, height: 900 },
  { name: "desktop_1920x1080", width: 1920, height: 1080 },
];

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  console.log("Browser launched. Checking responsive viewports on onboarding routes...");

  const overflowResults: { viewport: string; route: string; hasOverflow: boolean; scrollWidth: number; clientWidth: number }[] = [];

  for (const vp of VIEWPORTS) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // 1. Onboarding Hub (/onboard)
    await page.goto(`${BASE_URL}/onboard`, { waitUntil: "networkidle" });
    const onboardOverflow = await checkOverflow(page);
    overflowResults.push({ viewport: vp.name, route: "/onboard", ...onboardOverflow });

    if (vp.name === "mobile_375x812" || vp.name === "laptop_1440x900") {
      const onboardPath = path.join(SCREENSHOT_DIR, `onboard_${vp.name}.png`);
      await page.screenshot({ path: onboardPath, fullPage: false });
      console.log(`  Saved screenshot: ${onboardPath}`);
    }

    // 2. Sign in as Founder and inspect /founder/applications
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', "cookcue149@gmail.com");
    await page.fill('input[type="password"]', "DevPassword@123");
    await page.click('button:has-text("Sign In with Credentials")');
    await page.waitForURL(/\/founder/);

    await page.goto(`${BASE_URL}/founder/applications`, { waitUntil: "networkidle" });
    const appListOverflow = await checkOverflow(page);
    overflowResults.push({ viewport: vp.name, route: "/founder/applications", ...appListOverflow });

    if (vp.name === "mobile_375x812" || vp.name === "laptop_1440x900") {
      const appListPath = path.join(SCREENSHOT_DIR, `founder_applications_${vp.name}.png`);
      await page.screenshot({ path: appListPath, fullPage: false });
      console.log(`  Saved screenshot: ${appListPath}`);
    }

    await context.close();
  }

  await browser.close();

  console.log("\n================ ONBOARDING OVERFLOW AUDIT RESULTS ================");
  let hasAnyOverflow = false;
  for (const r of overflowResults) {
    if (r.hasOverflow) {
      console.error(`[OVERFLOW DETECTED] ${r.viewport} on ${r.route}: scrollWidth=${r.scrollWidth} > clientWidth=${r.clientWidth}`);
      hasAnyOverflow = true;
    } else {
      console.log(`[PASS] ${r.viewport} on ${r.route} (scrollWidth=${r.scrollWidth}, clientWidth=${r.clientWidth})`);
    }
  }

  if (!hasAnyOverflow) {
    console.log("\nAll viewports passed onboarding horizontal overflow verification with ZERO overflow!");
  }
}

async function checkOverflow(page: any) {
  return await page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const clientWidth = document.documentElement.clientWidth;
    return {
      hasOverflow: scrollWidth > clientWidth,
      scrollWidth,
      clientWidth,
    };
  });
}

run().catch((err) => {
  console.error("Error during onboarding responsive screenshot capture:", err);
  process.exit(1);
});
