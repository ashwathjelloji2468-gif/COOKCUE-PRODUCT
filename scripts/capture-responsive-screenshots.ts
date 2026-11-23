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
  console.log("Browser launched. Checking responsive viewports...");

  const overflowResults: { viewport: string; route: string; hasOverflow: boolean; scrollWidth: number; clientWidth: number }[] = [];

  for (const vp of VIEWPORTS) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // 1. Login Page
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    const loginOverflow = await checkOverflow(page);
    overflowResults.push({ viewport: vp.name, route: "/login", ...loginOverflow });

    if (vp.name === "mobile_375x812" || vp.name === "laptop_1440x900") {
      const loginPath = path.join(SCREENSHOT_DIR, `login_${vp.name}.png`);
      await page.screenshot({ path: loginPath, fullPage: false });
      console.log(`  Saved screenshot: ${loginPath}`);
    }

    // 2. Sign In as Head Cook
    await page.fill('input[type="email"]', "headcook@central-kitchen-a.com");
    await page.fill('input[type="password"]', "DevPassword@123");
    await page.click('button:has-text("Sign In with Credentials")');
    await page.waitForURL(/\/kitchen\/seed-kitchen-1\/morning/);

    // 3. Morning Plan Page
    await page.waitForLoadState("networkidle");
    const morningOverflow = await checkOverflow(page);
    overflowResults.push({ viewport: vp.name, route: "/morning", ...morningOverflow });

    if (vp.name === "mobile_375x812" || vp.name === "laptop_1440x900") {
      const morningPath = path.join(SCREENSHOT_DIR, `morning_${vp.name}.png`);
      await page.screenshot({ path: morningPath, fullPage: false });
      console.log(`  Saved screenshot: ${morningPath}`);
    }

    // 4. Closeout Page
    await page.goto(`${BASE_URL}/kitchen/seed-kitchen-1/closeout`, { waitUntil: "networkidle" });
    const closeoutOverflow = await checkOverflow(page);
    overflowResults.push({ viewport: vp.name, route: "/closeout", ...closeoutOverflow });

    if (vp.name === "mobile_375x812" || vp.name === "laptop_1440x900") {
      const closeoutPath = path.join(SCREENSHOT_DIR, `closeout_${vp.name}.png`);
      await page.screenshot({ path: closeoutPath, fullPage: false });
      console.log(`  Saved screenshot: ${closeoutPath}`);
    }

    // 5. Results Page
    await page.goto(`${BASE_URL}/kitchen/seed-kitchen-1/results`, { waitUntil: "networkidle" });
    const resultsOverflow = await checkOverflow(page);
    overflowResults.push({ viewport: vp.name, route: "/results", ...resultsOverflow });

    if (vp.name === "mobile_375x812" || vp.name === "laptop_1440x900") {
      const resultsPath = path.join(SCREENSHOT_DIR, `results_${vp.name}.png`);
      await page.screenshot({ path: resultsPath, fullPage: false });
      console.log(`  Saved screenshot: ${resultsPath}`);
    }

    // 6. Sign in as Founder and inspect Founder Overview
    await context.clearCookies();
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.fill('input[type="email"]', "cookcue149@gmail.com");
    await page.fill('input[type="password"]', "DevPassword@123");
    await page.click('button:has-text("Sign In with Credentials")');
    await page.waitForURL(/\/founder/);
    await page.waitForLoadState("networkidle");

    const founderOverflow = await checkOverflow(page);
    overflowResults.push({ viewport: vp.name, route: "/founder", ...founderOverflow });

    if (vp.name === "mobile_375x812" || vp.name === "laptop_1440x900") {
      const founderPath = path.join(SCREENSHOT_DIR, `founder_${vp.name}.png`);
      await page.screenshot({ path: founderPath, fullPage: false });
      console.log(`  Saved screenshot: ${founderPath}`);
    }

    await context.close();
  }

  await browser.close();

  console.log("\n================ OVERFLOW AUDIT RESULTS ================");
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
    console.log("\nAll viewports passed horizontal overflow verification with ZERO overflow!");
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
  console.error("Error during responsive screenshot capture:", err);
  process.exit(1);
});
