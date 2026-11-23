import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { getKitchenTodayStrip } from "../src/server/actions/kitchen-strip";
import { normalizeServiceDate } from "../src/lib/domain/date";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";

// Mock session module to control kitchen access
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireKitchenAccess, getSessionUser } from "../src/lib/auth/session";

describe("Phase 4 UX: Kitchen Today Strip", () => {
  const testKitchenIdA = "test-strip-kitchen-a";
  const testKitchenIdB = "test-strip-kitchen-b";
  const testContractorId = "test-strip-contractor";
  const testDate = "2026-11-20";

  let testDishId: string;

  beforeEach(async () => {
    vi.mocked(requireKitchenAccess).mockImplementation(async (kitchenId: string) => {
      if (kitchenId === "unauthorized-kitchen") {
        return { success: false, error: "Access denied" };
      }
      return {
        success: true,
        user: {
          id: "test-user-hc",
          email: "headcook@cookcue.com",
          name: "Head Cook",
          role: "HEAD_COOK",
          contractorId: testContractorId,
          kitchenId,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
        },
      };
    });

    vi.mocked(getSessionUser).mockResolvedValue({
      id: "test-user-hc",
      email: "headcook@cookcue.com",
      name: "Head Cook",
      role: "HEAD_COOK",
      contractorId: testContractorId,
      kitchenId: testKitchenIdA,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    // Cleanup
    await prisma.observationAudit.deleteMany({
      where: { observation: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } } },
    }).catch(() => {});
    await prisma.observation.deleteMany({
      where: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.planItem.deleteMany({
      where: { plan: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } } },
    }).catch(() => {});
    await prisma.cookingPlan.deleteMany({
      where: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.meal.deleteMany({
      where: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: testContractorId },
    }).catch(() => {});

    // Create contractor and kitchens
    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorId,
        code: ctrCode,
        name: "Strip Test Org",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdA,
        name: "Kitchen Alpha",
        contractorId: testContractorId,
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdB,
        name: "Kitchen Beta",
        contractorId: testContractorId,
      },
    });

    const dish = await prisma.dish.create({
      data: {
        name: "Strip Dal",
        kitchenId: testKitchenIdA,
        unit: "kg",
      },
    });
    testDishId = dish.id;
  });

  afterAll(async () => {
    await prisma.observationAudit.deleteMany({
      where: { observation: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } } },
    }).catch(() => {});
    await prisma.observation.deleteMany({
      where: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.planItem.deleteMany({
      where: { plan: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } } },
    }).catch(() => {});
    await prisma.cookingPlan.deleteMany({
      where: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.meal.deleteMany({
      where: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: testContractorId },
    }).catch(() => {});
  });

  it("1. Returns safe idle/empty state when no meal or plan exists today", async () => {
    const res = await getKitchenTodayStrip(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.planStatus).toBe("NO_PLAN");
    expect(res.data.closeoutStatus).toBe("NOT_STARTED");
    expect(res.data.expectedDiners).toBeNull();
    expect(res.data.nextAction.type).toBe("MORNING");
    expect(res.data.nextAction.label).toContain("Morning");
  });

  it("2. Reflects DRAFT plan status and prompts review & approve CTA", async () => {
    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "LUNCH",
        date: normalizeServiceDate(testDate),
        expectedDiners: 120,
      },
    });
    await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenIdA,
        mealId: meal.id,
        expectedDiners: 120,
        status: "DRAFT",
        approvalStatus: "DRAFT",
      },
    });

    const res = await getKitchenTodayStrip(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.planStatus).toBe("DRAFT");
    expect(res.data.closeoutStatus).toBe("NOT_STARTED");
    expect(res.data.expectedDiners).toBe(120);
    expect(res.data.nextAction.type).toBe("APPROVE");
    expect(res.data.nextAction.label).toContain("Approve");
  });

  it("3. Reflects APPROVED plan with missing closeout and points to Closeout CTA", async () => {
    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "LUNCH",
        date: normalizeServiceDate(testDate),
        expectedDiners: 140,
      },
    });
    await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenIdA,
        mealId: meal.id,
        expectedDiners: 140,
        status: "APPROVED",
        approvalStatus: "APPROVED",
      },
    });

    const res = await getKitchenTodayStrip(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.planStatus).toBe("APPROVED");
    expect(res.data.closeoutStatus).toBe("NOT_STARTED");
    expect(res.data.expectedDiners).toBe(140);
    expect(res.data.nextAction.type).toBe("CLOSEOUT");
    expect(res.data.nextAction.label).toContain("Closeout");
  });

  it("4. Reflects APPROVED plan with SUBMITTED closeout and points to Results CTA", async () => {
    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "LUNCH",
        date: normalizeServiceDate(testDate),
        expectedDiners: 150,
      },
    });
    await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenIdA,
        mealId: meal.id,
        expectedDiners: 150,
        status: "APPROVED",
        approvalStatus: "APPROVED",
      },
    });
    await prisma.observation.create({
      data: {
        mealId: meal.id,
        dishId: testDishId,
        kitchenId: testKitchenIdA,
        totalCookedKg: 30,
        unservedLeftoverKg: 1,
        actualDiners: 150,
        isStockout: false,
        isAbnormal: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    const res = await getKitchenTodayStrip(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.planStatus).toBe("APPROVED");
    expect(res.data.closeoutStatus).toBe("SUBMITTED");
    expect(res.data.nextAction.type).toBe("RESULTS");
  });

  it("5. Rejects unauthorized cross-kitchen access", async () => {
    const res = await getKitchenTodayStrip("unauthorized-kitchen", testDate, "LUNCH");
    expect(res.success).toBe(false);
  });
});
