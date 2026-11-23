import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import { getLastCloseoutPrefill, submitCloseout } from "../src/server/actions/closeout";
import { normalizeServiceDate } from "../src/lib/domain/date";

// Mock session module to grant kitchen access
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireKitchenAccess, getSessionUser } from "../src/lib/auth/session";

describe("Phase 1 UX: Same-as-last closeout prefill", () => {
  const testKitchenIdA = "test-prefill-kitchen-a";
  const testKitchenIdB = "test-prefill-kitchen-b";
  const testContractorId = "test-prefill-contractor";

  const dishAId = "test-prefill-dish-a";
  const dishBId = "test-prefill-dish-b";

  beforeEach(async () => {
    vi.mocked(requireKitchenAccess).mockImplementation(async (kitchenId: string) => {
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

    // Clean test records
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
        name: "Prefill Test Org",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdA,
        name: "Facility Alpha",
        contractorId: testContractorId,
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdB,
        name: "Facility Beta",
        contractorId: testContractorId,
      },
    });

    // Create dishes for Kitchen A
    await prisma.dish.create({
      data: {
        id: dishAId,
        name: "Jeera Rice",
        kitchenId: testKitchenIdA,
        unit: "KG",
      },
    });
    await prisma.dish.create({
      data: {
        id: dishBId,
        name: "Dal Tadka",
        kitchenId: testKitchenIdA,
        unit: "KG",
      },
    });
  });

  afterAll(async () => {
    await prisma.observationAudit.deleteMany({
      where: { observation: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } } },
    }).catch(() => {});
    await prisma.observation.deleteMany({
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

  it("1. Returns null when no prior service history exists", async () => {
    const res = await getLastCloseoutPrefill(testKitchenIdA, "LUNCH", "2026-11-20");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toBeNull();
    }
  });

  it("2. Returns last same-meal-type data when history exists", async () => {
    // Create an older meal on 2026-11-18 (LUNCH)
    const mealOlder = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "LUNCH",
        date: normalizeServiceDate("2026-11-18"),
        expectedDiners: 100,
      },
    });
    await prisma.observation.create({
      data: {
        mealId: mealOlder.id,
        dishId: dishAId,
        kitchenId: testKitchenIdA,
        totalCookedKg: 30,
        unservedLeftoverKg: 2,
        actualDiners: 100,
        isStockout: false,
        isAbnormal: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    // Create a more recent meal on 2026-11-19 (LUNCH)
    const mealRecent = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "LUNCH",
        date: normalizeServiceDate("2026-11-19"),
        expectedDiners: 140,
      },
    });
    await prisma.observation.create({
      data: {
        mealId: mealRecent.id,
        dishId: dishAId,
        kitchenId: testKitchenIdA,
        totalCookedKg: 35.5,
        unservedLeftoverKg: 1.25,
        actualDiners: 140,
        isStockout: false,
        isAbnormal: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });
    await prisma.observation.create({
      data: {
        mealId: mealRecent.id,
        dishId: dishBId,
        kitchenId: testKitchenIdA,
        totalCookedKg: 22.0,
        unservedLeftoverKg: 0.5,
        actualDiners: 140,
        isStockout: true,
        isAbnormal: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    // Create a DINNER service on 2026-11-19 (different mealType)
    const mealDinner = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "DINNER",
        date: normalizeServiceDate("2026-11-19"),
        expectedDiners: 80,
      },
    });
    await prisma.observation.create({
      data: {
        mealId: mealDinner.id,
        dishId: dishAId,
        kitchenId: testKitchenIdA,
        totalCookedKg: 15,
        unservedLeftoverKg: 1,
        actualDiners: 80,
        isStockout: false,
        isAbnormal: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    // Query prefill for LUNCH on 2026-11-20
    const res = await getLastCloseoutPrefill(testKitchenIdA, "LUNCH", "2026-11-20");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data).not.toBeNull();
    expect(res.data?.date).toBe("2026-11-19");
    expect(res.data?.mealType).toBe("LUNCH");
    expect(res.data?.actualDiners).toBe(140);
    expect(res.data?.items).toHaveLength(2);

    const dishA = res.data?.items.find((i) => i.dishId === dishAId);
    expect(dishA).toBeDefined();
    expect(dishA?.cookedKg).toBe(35.5);
    expect(dishA?.leftoverKg).toBe(1.25);
    expect(dishA?.isStockout).toBe(false);

    const dishB = res.data?.items.find((i) => i.dishId === dishBId);
    expect(dishB).toBeDefined();
    expect(dishB?.cookedKg).toBe(22.0);
    expect(dishB?.leftoverKg).toBe(0.5);
    expect(dishB?.isStockout).toBe(true);
  });

  it("3. Multi-tenant isolation: Never returns data from another kitchen", async () => {
    // Seed history only in Kitchen A
    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "LUNCH",
        date: normalizeServiceDate("2026-11-19"),
        expectedDiners: 110,
      },
    });
    await prisma.observation.create({
      data: {
        mealId: meal.id,
        dishId: dishAId,
        kitchenId: testKitchenIdA,
        totalCookedKg: 25,
        unservedLeftoverKg: 1,
        actualDiners: 110,
        isStockout: false,
        isAbnormal: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    // Request prefill for Kitchen B (Facility Beta)
    const resB = await getLastCloseoutPrefill(testKitchenIdB, "LUNCH", "2026-11-20");
    expect(resB.success).toBe(true);
    if (resB.success) {
      expect(resB.data).toBeNull();
    }
  });

  it("4. Submit still required: getLastCloseoutPrefill does not auto-submit or mutate observations", async () => {
    // Seed 1 existing historical service
    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "LUNCH",
        date: normalizeServiceDate("2026-11-18"),
        expectedDiners: 100,
      },
    });
    await prisma.observation.create({
      data: {
        mealId: meal.id,
        dishId: dishAId,
        kitchenId: testKitchenIdA,
        totalCookedKg: 20,
        unservedLeftoverKg: 2,
        actualDiners: 100,
        isStockout: false,
        isAbnormal: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    const obsCountBefore = await prisma.observation.count({
      where: { kitchenId: testKitchenIdA },
    });

    // Call prefill
    const prefillRes = await getLastCloseoutPrefill(testKitchenIdA, "LUNCH", "2026-11-19");
    expect(prefillRes.success).toBe(true);
    expect(prefillRes.data).not.toBeNull();

    // Verify observation count did NOT change (no auto-submission)
    const obsCountAfter = await prisma.observation.count({
      where: { kitchenId: testKitchenIdA },
    });
    expect(obsCountAfter).toBe(obsCountBefore);
  });
});
