import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  buildReminderCandidates,
  executeOperationalRemindersInternal,
  sendOperationalReminders,
} from "../src/server/actions/reminders";
import {
  buildReminderEmailContent,
  getChannelReadiness,
} from "../src/lib/kitchen/reminders";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import { generateNextUserCode } from "../src/server/actions/user-code";
import { normalizeServiceDate, toServiceDateString } from "../src/lib/domain/date";
import { clearSentEmails, getSentEmails } from "../src/lib/email";

// Mock authentication session
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
  };
});

import { requireFounder } from "../src/lib/auth/session";

describe("WAVE 3 / T3-A — Operational Reminders", () => {
  const testContractorAId = "test-rem-ctr-a";
  const testContractorBId = "test-rem-ctr-b";
  const testKitchenAId = "test-rem-kitchen-a";
  const testKitchenBId = "test-rem-kitchen-b";
  const testUserAId = "test-rem-user-a";
  const testUserBId = "test-rem-user-b";
  const testDishAId = "test-rem-dish-a";
  const testDishBId = "test-rem-dish-b";

  const todayStr = toServiceDateString(new Date());
  const todayMidnight = normalizeServiceDate(todayStr);

  beforeAll(async () => {
    // Clean up any stale records
    const kIds = [testKitchenAId, testKitchenBId];
    const uIds = [testUserAId, testUserBId];
    const cIds = [testContractorAId, testContractorBId];

    await prisma.operationalReminderLog.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: uIds } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: kIds } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: { in: cIds } } }).catch(() => {});

    // 1. Setup Contractor A & Kitchen A with Head Cook A
    const codeA = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorAId,
        code: codeA,
        name: "Contractor Alpha",
        status: "ACTIVE",
        contactEmail: "admin@contractor-alpha.com",
        kitchens: {
          create: [
            {
              id: testKitchenAId,
              name: "Alpha Kitchen",
              status: "ACTIVE",
            },
          ],
        },
      },
    });

    const userCodeA = await generateNextUserCode();
    await prisma.user.create({
      data: {
        id: testUserAId,
        code: userCodeA,
        email: "headcook.alpha@messwise.test",
        name: "Chef Alpha",
        role: "HEAD_COOK",
        status: "ACTIVE",
        contractorId: testContractorAId,
        kitchenId: testKitchenAId,
      },
    });

    await prisma.dish.create({
      data: {
        id: testDishAId,
        kitchenId: testKitchenAId,
        name: "Basmati Rice",
        unit: "kg",
      },
    });

    // 2. Setup Contractor B & Kitchen B with Head Cook B
    const codeB = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorBId,
        code: codeB,
        name: "Contractor Beta",
        status: "ACTIVE",
        contactEmail: "admin@contractor-beta.com",
        kitchens: {
          create: [
            {
              id: testKitchenBId,
              name: "Beta Kitchen",
              status: "ACTIVE",
            },
          ],
        },
      },
    });

    const userCodeB = await generateNextUserCode();
    await prisma.user.create({
      data: {
        id: testUserBId,
        code: userCodeB,
        email: "headcook.beta@messwise.test",
        name: "Chef Beta",
        role: "HEAD_COOK",
        status: "ACTIVE",
        contractorId: testContractorBId,
        kitchenId: testKitchenBId,
      },
    });

    await prisma.dish.create({
      data: {
        id: testDishBId,
        kitchenId: testKitchenBId,
        name: "Mixed Dal",
        unit: "kg",
      },
    });

    // 3. Operational Exception 1 (Kitchen A): Today's meal has DRAFT plan -> PLAN_NOT_APPROVED
    const mealA = await prisma.meal.create({
      data: {
        kitchenId: testKitchenAId,
        date: todayMidnight,
        mealType: "LUNCH",
        expectedDiners: 200,
      },
    });

    await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenAId,
        mealId: mealA.id,
        expectedDiners: 200,
        status: "DRAFT",
        approvalStatus: "DRAFT",
      },
    });

    // 4. Operational Exception 2 (Kitchen B): Meal has APPROVED plan but NO closeout -> CLOSEOUT_MISSING
    const mealB = await prisma.meal.create({
      data: {
        kitchenId: testKitchenBId,
        date: todayMidnight,
        mealType: "DINNER",
        expectedDiners: 180,
      },
    });

    await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenBId,
        mealId: mealB.id,
        expectedDiners: 180,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApprovedAt: new Date(Date.now() - 3600 * 1000),
      },
    });
  });

  afterAll(async () => {
    const kIds = [testKitchenAId, testKitchenBId];
    const uIds = [testUserAId, testUserBId];
    const cIds = [testContractorAId, testContractorBId];

    await prisma.operationalReminderLog.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: uIds } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: kIds } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: { in: cIds } } }).catch(() => {});
  });

  beforeEach(() => {
    clearSentEmails();
  });

  it("1. buildReminderCandidates lists PLAN_NOT_APPROVED and CLOSEOUT_MISSING with strict tenant isolation", async () => {
    const candidates = await buildReminderCandidates(todayStr);
    expect(candidates.length).toBeGreaterThanOrEqual(2);

    // Kitchen A check: PLAN_NOT_APPROVED
    const candA = candidates.find((c) => c.kitchenId === testKitchenAId);
    expect(candA).toBeDefined();
    expect(candA?.type).toBe("PLAN_NOT_APPROVED");
    expect(candA?.kitchenName).toBe("Alpha Kitchen");
    expect(candA?.mealType).toBe("LUNCH");
    expect(candA?.recipientType).toBe("HEAD_COOK");
    expect(candA?.recipientEmails).toEqual(["headcook.alpha@messwise.test"]);
    // Must NOT leak to contractor B or head cook B
    expect(candA?.recipientEmails).not.toContain("headcook.beta@messwise.test");
    expect(candA?.href).toBe(`/kitchen/${testKitchenAId}/morning`);

    // Kitchen B check: CLOSEOUT_MISSING
    const candB = candidates.find((c) => c.kitchenId === testKitchenBId);
    expect(candB).toBeDefined();
    expect(candB?.type).toBe("CLOSEOUT_MISSING");
    expect(candB?.kitchenName).toBe("Beta Kitchen");
    expect(candB?.mealType).toBe("DINNER");
    expect(candB?.recipientType).toBe("HEAD_COOK");
    expect(candB?.recipientEmails).toEqual(["headcook.beta@messwise.test"]);
    // Must NOT leak to contractor A or head cook A
    expect(candB?.recipientEmails).not.toContain("headcook.alpha@messwise.test");
    expect(candB?.href).toBe(`/kitchen/${testKitchenBId}/closeout`);
  });

  it("2. Formats plain operational email copy without marketing fluff", async () => {
    const candidates = await buildReminderCandidates(todayStr);
    const candA = candidates.find((c) => c.kitchenId === testKitchenAId)!;
    const content = buildReminderEmailContent(candA);

    expect(content.subject).toBe(`[CookCue] Action needed: Alpha Kitchen LUNCH ${todayStr}`);
    expect(content.text).toContain("is in DRAFT and requires approval");
    expect(content.text).toContain(`/kitchen/${testKitchenAId}/morning`);
    expect(content.text).toContain("No auto-approval or auto-submission has occurred");
    expect(content.html).toContain("Open CookCue to Complete Action");
  });

  it("3. dryRun lists candidates without sending emails or writing log records", async () => {
    const res = await executeOperationalRemindersInternal({ dryRun: true, date: todayStr });

    expect(res.dryRun).toBe(true);
    expect(res.totalCandidates).toBeGreaterThanOrEqual(2);
    expect(res.sentCount).toBe(0);
    expect(res.failedCount).toBe(0);
    expect(getSentEmails().length).toBe(0);

    // Verify no log rows were written
    const logs = await prisma.operationalReminderLog.findMany({
      where: { kitchenId: { in: [testKitchenAId, testKitchenBId] } },
    });
    expect(logs.length).toBe(0);
  });

  it("4. Live run sends emails and creates deduplication log records", async () => {
    const res = await executeOperationalRemindersInternal({ dryRun: false, date: todayStr });

    expect(res.dryRun).toBe(false);
    expect(res.sentCount).toBeGreaterThanOrEqual(2);
    expect(res.failedCount).toBe(0);

    // Verify emails were captured in transport
    const sent = getSentEmails();
    expect(sent.length).toBeGreaterThanOrEqual(2);
    expect(sent.some((e) => e.to === "headcook.alpha@messwise.test")).toBe(true);
    expect(sent.some((e) => e.to === "headcook.beta@messwise.test")).toBe(true);

    // Verify audit log rows were recorded
    const logs = await prisma.operationalReminderLog.findMany({
      where: {
        kitchenId: { in: [testKitchenAId, testKitchenBId] },
        status: "SENT",
      },
    });
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });

  it("5. 6-Hour Deduplication prevents spamming the same kitchen+meal+date+type", async () => {
    // Run second time immediately
    const res = await executeOperationalRemindersInternal({ dryRun: false, date: todayStr });

    const candA = res.candidates.find((c) => c.kitchenId === testKitchenAId);
    expect(candA?.isDeduplicated).toBe(true);
    expect(candA?.skipReason).toContain("Already sent within the last 6 hours");

    const candB = res.candidates.find((c) => c.kitchenId === testKitchenBId);
    expect(candB?.isDeduplicated).toBe(true);

    // No new emails should be sent during the dedup window
    expect(getSentEmails().length).toBe(0);
    expect(res.sentCount).toBe(0);
    expect(res.skippedCount).toBeGreaterThanOrEqual(2);
  });

  it("6. Server action enforces requireFounder authorization check", async () => {
    // Non-founder caller -> 403 / error
    vi.mocked(requireFounder).mockResolvedValueOnce({
      success: false,
      error: "Founder authorization required",
    });

    const denied = await sendOperationalReminders({ dryRun: true });
    expect(denied.success).toBe(false);
    if (!denied.success) {
      expect(denied.error).toBe("Founder authorization required");
    }

    // Founder caller -> success
    vi.mocked(requireFounder).mockResolvedValueOnce({
      success: true,
      user: { id: "founder-1", email: "cookcue149@gmail.com", role: "FOUNDER" } as any,
    });

    const allowed = await sendOperationalReminders({ dryRun: true });
    expect(allowed.success).toBe(true);
  });

  it("7. Reports 'email only' channel readiness when Twilio is not configured", () => {
    const readiness = getChannelReadiness();
    expect(readiness.email).toBe(true);
    expect(readiness.summary).toBe("email only");
  });
});
