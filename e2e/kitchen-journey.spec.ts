import { test, expect, Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { getSentEmails } from "../src/lib/email";
import { hashPassword, hashBearerToken } from "../src/lib/auth/crypto";

test.describe("CookCue Institutional Kitchen & Founder E2E Journeys", () => {
  const KITCHEN_A_ID = "seed-kitchen-1";
  const KITCHEN_B_ID = "seed-kitchen-2";
  const HEAD_COOK_EMAIL = "headcook@central-kitchen-a.com";
  const FOUNDER_EMAIL = "cookcue149@gmail.com";
  const PASSWORD = "DevPassword@123";

  // Unique target service date for this test run to prevent collision with past test executions
  const randomMonth = String((Date.now() % 12) + 1).padStart(2, "0");
  const randomDay = String((Date.now() % 28) + 1).padStart(2, "0");
  const testDate = `2028-${randomMonth}-${randomDay}`;

  test.beforeAll(async () => {
    const passwordHash = hashPassword(PASSWORD);

    // 1. Ensure Demo Contractor
    let contractor = await prisma.contractor.findFirst({
      where: { OR: [{ id: "seed-contractor-1" }, { code: "CTR-000001" }] },
    });
    if (!contractor) {
      contractor = await prisma.contractor.create({
        data: {
          id: "seed-contractor-1",
          code: "CTR-000001",
          name: "Demo Contractor Pvt Ltd",
          status: "ACTIVE",
        },
      });
    }

    // 2. Ensure Demo Kitchens
    await prisma.kitchen.upsert({
      where: { id: KITCHEN_A_ID },
      update: { contractorId: contractor.id, status: "ACTIVE" },
      create: {
        id: KITCHEN_A_ID,
        contractorId: contractor.id,
        name: "Central Kitchen A",
        location: "Bangalore",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.upsert({
      where: { id: KITCHEN_B_ID },
      update: { contractorId: contractor.id, status: "ACTIVE" },
      create: {
        id: KITCHEN_B_ID,
        contractorId: contractor.id,
        name: "Hostel Kitchen B",
        location: "Hyderabad",
        status: "ACTIVE",
      },
    });

    // 3. Ensure Founder User with PASSWORD ("DevPassword@123")
    await prisma.user.upsert({
      where: { email: FOUNDER_EMAIL },
      update: {
        passwordHash,
        status: "ACTIVE",
        role: "FOUNDER",
      },
      create: {
        email: FOUNDER_EMAIL,
        name: "Platform Founder",
        role: "FOUNDER",
        status: "ACTIVE",
        passwordHash,
      },
    });

    // 4. Ensure Head Cook User with PASSWORD ("DevPassword@123")
    await prisma.user.upsert({
      where: { email: HEAD_COOK_EMAIL },
      update: {
        passwordHash,
        status: "ACTIVE",
        role: "HEAD_COOK",
        kitchenId: KITCHEN_A_ID,
        contractorId: contractor.id,
      },
      create: {
        email: HEAD_COOK_EMAIL,
        name: "Chef Rajesh",
        role: "HEAD_COOK",
        status: "ACTIVE",
        kitchenId: KITCHEN_A_ID,
        contractorId: contractor.id,
        passwordHash,
      },
    });

    // 5. Ensure Seed Dishes for Kitchen A
    await prisma.dish.upsert({
      where: { id: "seed-dish-1" },
      update: { kitchenId: KITCHEN_A_ID },
      create: {
        id: "seed-dish-1",
        kitchenId: KITCHEN_A_ID,
        name: "Rice",
        unit: "kg",
      },
    });

    await prisma.dish.upsert({
      where: { id: "seed-dish-2" },
      update: { kitchenId: KITCHEN_A_ID },
      create: {
        id: "seed-dish-2",
        kitchenId: KITCHEN_A_ID,
        name: "Dal",
        unit: "kg",
      },
    });
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  async function signInAsHeadCook(page: Page) {
    await page.goto("/login");
    await page.fill('input[type="email"]', HEAD_COOK_EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Sign In with Credentials")');
    await expect(page).toHaveURL(new RegExp(`/kitchen/${KITCHEN_A_ID}/morning`), { timeout: 15000 });
  }

  async function signInAsFounder(page: Page) {
    await page.goto("/login");
    await page.fill('input[type="email"]', FOUNDER_EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Sign In with Credentials")');
    await expect(page).toHaveURL(/\/founder/, { timeout: 15000 });
  }

  test("1. Authentication, credential verification, and sign out", async ({ page }) => {
    // Attempting unauthenticated access to /founder redirects to /login with redirect param
    await page.goto("/founder");
    await expect(page).toHaveURL(/\/login\?redirect=%2Ffounder/);

    // Attempting unauthenticated access to /kitchen redirects to /login
    await page.goto(`/kitchen/${KITCHEN_A_ID}/morning`);
    await expect(page).toHaveURL(/\/login/);

    // Perform credential-verified sign in
    await page.goto("/login");
    await page.fill('input[type="email"]', HEAD_COOK_EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Sign In with Credentials")');

    // Successfully redirects to assigned kitchen morning plan
    await expect(page).toHaveURL(new RegExp(`/kitchen/${KITCHEN_A_ID}/morning`));

    // Sign out via UserMenu
    const chefMenuButton = page.locator('button:has-text("Chef Station"), button:has-text("Chef Rajesh"), button:has-text("HEAD_COOK")').first();
    await chefMenuButton.click();
    await page.click('text=Sign out');
    await expect(page).toHaveURL(/\/login/);
  });

  test("2. Session integrity: invalid token rejection and session expiration", async ({ page, context }) => {
    // Set a forged / invalid HMAC cookie
    await page.goto("/login");
    await context.addCookies([
      {
        name: "messwise_session",
        value: "eyJyZXZva2VkIjpmYWxzZX0=.invalidsignature",
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    // Navigating to protected routes with forged cookie should be rejected by middleware
    await page.goto(`/kitchen/${KITCHEN_A_ID}/morning`);
    await expect(page).toHaveURL(/\/login\?error=invalid_session/);

    // Clear and test expired session payload
    await context.clearCookies();
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const expiredPayload = Buffer.from(
      JSON.stringify({
        userId: "test-user-id",
        role: "HEAD_COOK",
        kitchenId: KITCHEN_A_ID,
        email: HEAD_COOK_EMAIL,
        sessionVersion: 1,
        exp: expiredTimestamp,
      })
    ).toString("base64url");

    // Even if signature is syntactically formatted, expired timestamp must be rejected
    await context.addCookies([
      {
        name: "messwise_session",
        value: `${expiredPayload}.dummyhmacsignature`,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto(`/kitchen/${KITCHEN_A_ID}/morning`);
    await expect(page).toHaveURL(/\/login\?error=/);

    // Clean up test cookies
    await context.clearCookies();
  });

  test("3. Founder vs Kitchen Operator RBAC and cross-kitchen access isolation", async ({ page }) => {
    // 1. Login as Head Cook (assigned strictly to Central Kitchen A)
    await signInAsHeadCook(page);

    // RBAC: Head Cook accessing /founder is denied and redirected back to assigned kitchen
    await page.goto("/founder");
    await expect(page).toHaveURL(new RegExp(`/kitchen/${KITCHEN_A_ID}/morning`));

    // Cross-kitchen isolation: Head Cook attempting to access Kitchen B is denied & redirected
    await page.goto(`/kitchen/${KITCHEN_B_ID}/morning`);
    await expect(page).toHaveURL(new RegExp(`/kitchen/${KITCHEN_A_ID}/morning`));

    // Sign out
    const chefMenuButton = page.locator('button:has-text("Chef Station"), button:has-text("Chef Rajesh"), button:has-text("HEAD_COOK")').first();
    await chefMenuButton.click();
    await page.click('text=Sign out');
    await expect(page).toHaveURL(/\/login/);

    // 2. Login as Founder
    await signInAsFounder(page);

    // Founder has universal access: can view Founder portal
    await expect(page.locator("h1")).toContainText("Platform Operations Overview");

    // Founder can inspect any institutional kitchen
    await page.goto(`/kitchen/${KITCHEN_A_ID}/morning`);
    await expect(page.locator("h1")).toContainText("Morning Cooking Plan");

    await page.goto(`/kitchen/${KITCHEN_B_ID}/morning`);
    await expect(page.locator("h1")).toContainText("Morning Cooking Plan");
  });

  test("4. Station dish catalog management and menu configuration", async ({ page }) => {
    // Authenticate as Head Cook
    await signInAsHeadCook(page);

    // Navigate to Station Dish Catalog
    await page.goto(`/kitchen/${KITCHEN_A_ID}/dishes`);
    await expect(page.locator("h1")).toContainText("Station Dish Catalog");

    // Add a unique dish
    const uniqueDishName = `Special Biryani ${Date.now()}`;
    await page.fill('input[placeholder*="Sambar"]', uniqueDishName);
    await page.click("text=Add Dish");

    // Verify dish appears in catalog table
    await expect(page.locator(`text=${uniqueDishName}`).first()).toBeVisible();

    // Verify newly added dish is available for selection in morning plan
    await page.goto(`/kitchen/${KITCHEN_A_ID}/morning`);
    await expect(page.locator(`button:has-text("${uniqueDishName}")`)).toBeVisible();
  });

  test("5. Morning cooking plan: recommendation baselines, manager override, and persistence", async ({ page }) => {
    // Authenticate as Head Cook
    await signInAsHeadCook(page);

    // Select test date and meal type
    await page.selectOption("select >> nth=0", "BREAKFAST");
    await page.fill('input[type="date"]', testDate);

    // Input expected diners
    await page.fill('input[type="number"]', "150");

    // Select dishes
    await page.click("text=Select All Dishes");

    // Generate recommendations
    await page.click("text=Generate Pure Baseline Recommendations");

    // Verify recommendation cards render with calculation breakdown
    await expect(page.locator("text=Recommended Production Quantities")).toBeVisible();
    await expect(page.locator("text=Expected diners:").first()).toBeVisible();

    // Manager override: fill approved quantity input for the first item
    const approvedInputs = page.locator('input[placeholder="0.00"]');
    if ((await approvedInputs.count()) > 0) {
      await approvedInputs.first().fill("35.5");
    }

    // Approve & Save Plan
    await page.click("text=Approve & Save Cooking Plan");
    await expect(page.locator("text=Cooking plan approved and saved")).toBeVisible();
  });

  test("6. Service closeout: planned meal retrieval, actuals recording, and audit persistence", async ({ page }) => {
    // Authenticate as Head Cook
    await signInAsHeadCook(page);

    // Navigate to Closeout station
    await page.goto(`/kitchen/${KITCHEN_A_ID}/closeout`);
    await expect(page.locator("h1")).toContainText("Evening Meal Closeout");

    // Select the planned service (BREAKFAST on testDate) and load plan
    await page.selectOption("select >> nth=0", "BREAKFAST");
    await page.fill('input[type="date"]', testDate);
    await page.click("text=Load Approved Plan");

    // Verify morning target is loaded into closeout template
    await expect(page.locator("text=Morning target:").first()).toBeVisible();

    // Fill actual diners and cooked actuals
    await page.fill('input[type="number"]', "145");
    const cookedInputs = page.locator('input[placeholder="0.00"]');
    if ((await cookedInputs.count()) > 0) {
      await cookedInputs.first().fill("34.0");
    }

    // Submit evening closeout
    await page.click("text=Submit Evening Closeout");
    await expect(page.locator("text=Meal closeout submitted successfully")).toBeVisible();

    // Verify recent service closeout records update
    await expect(page.locator("text=Recent Service Closeout Records")).toBeVisible();
  });

  test("7. Snapshot immutability: finalized closeout rejects subsequent plan changes", async ({ page }) => {
    // Authenticate as Head Cook
    await signInAsHeadCook(page);

    // Navigate back to Morning Plan for the service that already has a closeout submitted
    await page.goto(`/kitchen/${KITCHEN_A_ID}/morning`);
    await page.selectOption("select >> nth=0", "BREAKFAST");
    await page.fill('input[type="date"]', testDate);
    await page.fill('input[type="number"]', "160");
    await page.click("text=Select All Dishes");
    await page.click("text=Generate Pure Baseline Recommendations");

    // Attempt to approve & re-save plan for finalized meal
    await page.click("text=Approve & Save Cooking Plan");

    // Verify immutability error alert is triggered
    await expect(
      page.locator("text=Cannot modify cooking plan: service closeout has already been recorded for this meal")
    ).toBeVisible();
  });

  test("8. Unplanned meal entry and closeout retry tolerance", async ({ page }) => {
    // Authenticate as Head Cook
    await signInAsHeadCook(page);

    // Navigate to Closeout station
    await page.goto(`/kitchen/${KITCHEN_A_ID}/closeout`);

    // Select distinct meal service (SNACK or DINNER on a distinct future date)
    const unplannedDate = "2026-11-26";
    await page.selectOption("select >> nth=0", "DINNER");
    await page.fill('input[type="date"]', unplannedDate);

    // Record meal without prior morning plan
    await page.click("text=Record Meal Without Prior Plan");

    // Fill actual cooked kg and leftovers
    const cookedInputs = page.locator('input[placeholder="0.00"]');
    if ((await cookedInputs.count()) > 0) {
      await cookedInputs.first().fill("42.0");
    }

    // Submit closeout first time
    await page.click("text=Submit Evening Closeout");
    await expect(page.locator("text=Meal closeout submitted successfully")).toBeVisible();

    // Idempotent retry: re-submitting closeout updates observations cleanly without 500 error
    await page.click("text=Submit Evening Closeout");
    await expect(page.locator("text=Meal closeout submitted successfully")).toBeVisible();
  });

  test("9. Operational results dashboard, metric cards, and meal filters", async ({ page }) => {
    // Authenticate as Head Cook
    await signInAsHeadCook(page);

    // Navigate to Results Dashboard
    await page.goto(`/kitchen/${KITCHEN_A_ID}/results`);
    await expect(page.locator("h1")).toContainText("Station Results & Metrics");

    // Verify key performance metric cards render
    await expect(page.locator("text=Actual Cooked")).toBeVisible();
    await expect(page.locator("text=Approved Target")).toBeVisible();
    await expect(page.locator("text=Suggested Baseline")).toBeVisible();
    await expect(page.locator("text=Unserved Leftovers")).toBeVisible();

    // Verify service records table renders
    await expect(page.locator("table")).toBeVisible();

    // Apply service filter for LUNCH services
    await page.selectOption("select >> nth=0", "LUNCH");
    await page.click("text=Apply Filters");

    // Verify table updates without runtime error or NaN
    await expect(page.locator("table")).toBeVisible();
  });

  test("10. Multi-path onboarding: submission, email verification, founder console approval, and account activation", async ({ page, context }) => {
    const timestamp = Date.now();
    const candidateEmail = `applicant_${timestamp}@collegecampus.edu`;

    // 1. Visit Login Page and confirm the three onboarding applicant paths are visible
    await page.goto("/login");
    await expect(page.locator("text=Register Contractor")).toBeVisible();
    await expect(page.locator("text=Apply as Head Cook")).toBeVisible();
    await expect(page.locator("text=Apply as Staff")).toBeVisible();

    // 2. Click Register Contractor
    await page.click("text=Register Contractor");
    await expect(page).toHaveURL(/\/onboard\?type=contractor/);

    // 3. Fill out Contractor Registration Form
    await page.fill('input[placeholder*="Rajesh"]', "Vikram Seth");
    await page.fill('input[placeholder*="organization.com"]', candidateEmail);
    await page.fill('input[placeholder*="Apex Catering"]', `Apex Mess Services ${timestamp}`);
    await page.fill('input[placeholder*="Central Kitchen A"]', "Campus South Hall");
    await page.fill('input[placeholder*="Bangalore"]', "Bangalore Main");

    await page.click('button:has-text("Submit Application")');

    // 4. Expect Email Verification Screen
    await expect(page.locator("text=Verify Your Email Address")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=${candidateEmail}`)).toBeVisible({ timeout: 15000 });

    // 5. Query the generated application and extract token from captured email
    const app = await prisma.onboardingApplication.findFirst({
      where: { applicantEmail: candidateEmail },
    });
    expect(app).not.toBeNull();
    expect(app?.emailVerificationToken).toBeTruthy();

    let verifyEmail;
    for (let i = 0; i < 20; i++) {
      const sent = getSentEmails();
      verifyEmail = sent.find(
        (e) => e.to.toLowerCase() === candidateEmail.toLowerCase() && e.subject.includes("Verify")
      );
      if (verifyEmail) break;
      await page.waitForTimeout(200);
    }
    expect(verifyEmail).toBeDefined();
    const rawVerifyToken = (verifyEmail!.html + " " + verifyEmail!.text).match(/token=([a-f0-9]+)/)?.[1];
    expect(rawVerifyToken).toBeTruthy();

    // Verify token security: only SHA-256 hash is in the database, raw token is never stored
    expect(app!.emailVerificationToken).toBe(hashBearerToken(rawVerifyToken!));
    expect(app!.emailVerificationToken).not.toBe(rawVerifyToken);

    // 6. Complete Email Verification using raw token from email
    await page.goto(`/verify-email?token=${rawVerifyToken}`);
    await expect(page.locator("text=Email Verified!")).toBeVisible({ timeout: 15000 });

    // 7. Founder Console Review & Approval Flow
    await signInAsFounder(page);
    await page.goto("/founder/applications");
    await expect(page.locator("h1")).toContainText("Onboarding Applications");

    // Click Review for this applicant
    await page.click(`tr:has-text("${candidateEmail}") a:has-text("Review")`);
    await expect(page.locator("h1")).toContainText("Vikram Seth");
    await expect(page.locator("text=Email Verified")).toBeVisible();

    // Founder approves contractor application
    await page.click('button:has-text("Approve & Provision Contractor Org")');
    await expect(page.locator("text=Application approved!")).toBeVisible({ timeout: 15000 });

    // 8. Extract single-use activation token from captured email
    const approvedApp = await prisma.onboardingApplication.findUnique({
      where: { id: app!.id },
    });
    expect(approvedApp?.status).toBe("APPROVED_PENDING_ACTIVATION");
    expect(approvedApp?.activationToken).toBeTruthy();

    let approvalEmail;
    for (let i = 0; i < 20; i++) {
      const sentAfterApprove = getSentEmails();
      approvalEmail = sentAfterApprove.find(
        (e) => e.to.toLowerCase() === candidateEmail.toLowerCase() && e.subject.toLowerCase().includes("approved")
      );
      if (approvalEmail) break;
      await page.waitForTimeout(200);
    }
    expect(approvalEmail).toBeDefined();
    const rawActivationToken = (approvalEmail!.html + " " + approvalEmail!.text).match(/token=([a-f0-9]+)/)?.[1];
    expect(rawActivationToken).toBeTruthy();

    // Verify activation token security: only SHA-256 hash in DB
    expect(approvedApp!.activationToken).toBe(hashBearerToken(rawActivationToken!));
    expect(approvedApp!.activationToken).not.toBe(rawActivationToken);

    // 9. Activate account in candidate browser session using raw token
    await context.clearCookies();
    await page.goto(`/activate?token=${rawActivationToken}`);
    await expect(page.locator("h1")).toContainText("Activate Your Account");

    await page.fill('input[placeholder="At least 8 characters"]', "NewCateringPass@123");
    await page.fill('input[placeholder="Re-enter password"]', "NewCateringPass@123");
    await page.click('button:has-text("Activate CookCue Account")');

    // 10. Automatically authenticated and redirected
    await expect(page).not.toHaveURL(/\/activate/, { timeout: 15000 });

    // 11. In-app approval notification is displayed
    await expect(page.locator("text=Account Provisioned & Approved")).toBeVisible({ timeout: 15000 });

    // Dismiss in-app notification
    await page.click('button[title="Acknowledge notification"]');
    await expect(page.locator("text=Account Provisioned & Approved")).not.toBeVisible();
  });
});
