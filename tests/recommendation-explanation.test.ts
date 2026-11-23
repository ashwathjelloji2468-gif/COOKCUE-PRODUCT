import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import { getRecommendationExplanation } from "../src/server/actions/morning-plan";

// Mock session module
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireKitchenAccess, getSessionUser } from "../src/lib/auth/session";

describe("Wave 2 / T2-D: 'Why this kg?' Recommendation Explanation", () => {
  const testKitchenIdA = "test-explain-kitchen-alpha";
  const testKitchenIdB = "test-explain-kitchen-beta";
  const testContractorId = "test-explain-contractor";
  const testDate = "2026-11-25";

  let testDishIdA: string;
  let testDishIdOther: string;
  let headCookUserId: string;

  beforeEach(async () => {
    // 1. Clean previous records
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
    await prisma.user.deleteMany({
      where: { id: "explain-cook-user" },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: testContractorId },
    }).catch(() => {});

    // 2. Provision contractor & kitchens
    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: { id: testContractorId, code: ctrCode, name: "Explain Catering Org", status: "ACTIVE" },
    });

    await prisma.kitchen.create({
      data: { id: testKitchenIdA, contractorId: testContractorId, name: "East Dining Hall", status: "ACTIVE" },
    });

    await prisma.kitchen.create({
      data: { id: testKitchenIdB, contractorId: testContractorId, name: "West Dining Hall", status: "ACTIVE" },
    });

    // 3. User
    const cook = await prisma.user.create({
      data: {
        id: "explain-cook-user",
        email: "chef_east@explaintarget.com",
        name: "Chef Maya",
        role: "HEAD_COOK",
        kitchenId: testKitchenIdA,
        code: "USR-000661",
      },
    });
    headCookUserId = cook.id;

    // 4. Dishes
    const d1 = await prisma.dish.create({
      data: { kitchenId: testKitchenIdA, name: "Sambar", unit: "kg" },
    });
    const dOther = await prisma.dish.create({
      data: { kitchenId: testKitchenIdB, name: "Sambar", unit: "kg" },
    });
    testDishIdA = d1.id;
    testDishIdOther = dOther.id;
  });

  it("1. Rejects unauthorized and cross-kitchen requests with 403", async () => {
    // Cross kitchen denied
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: false,
      error: "Forbidden: cross-kitchen access denied",
      statusCode: 403,
    });

    const res = await getRecommendationExplanation(testKitchenIdA, testDishIdA, "LUNCH", 150);
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.error).toContain("cross-kitchen");
  });

  it("2. Rejects if dish does not belong to target kitchen with 404", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUserId,
        email: "chef_east@explaintarget.com",
        name: "Chef Maya",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    // testDishIdOther belongs to Kitchen B, not Kitchen A
    const res = await getRecommendationExplanation(testKitchenIdA, testDishIdOther, "LUNCH", 150);
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(404);
  });

  it("3. Insufficient history explanation: clearly explains why no number is shown and shows exclusions", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: {
        id: headCookUserId,
        email: "chef_east@explaintarget.com",
        name: "Chef Maya",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    // Create 1 clean service and 1 stockout service for LUNCH (only 1 eligible < 3 required)
    const m1 = await prisma.meal.create({
      data: { kitchenId: testKitchenIdA, date: new Date("2026-11-20T00:00:00Z"), mealType: "LUNCH" },
    });
    await prisma.observation.create({
      data: {
        mealId: m1.id,
        dishId: testDishIdA,
        kitchenId: testKitchenIdA,
        actualDiners: 100,
        totalCookedKg: 20.0,
        unservedLeftoverKg: 2.0,
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    const m2 = await prisma.meal.create({
      data: { kitchenId: testKitchenIdA, date: new Date("2026-11-21T00:00:00Z"), mealType: "LUNCH" },
    });
    await prisma.observation.create({
      data: {
        mealId: m2.id,
        dishId: testDishIdA,
        kitchenId: testKitchenIdA,
        actualDiners: 110,
        totalCookedKg: 18.0,
        unservedLeftoverKg: 0.0,
        isStockout: true, // Stockout: excluded!
        isAbnormal: false,
        isExcluded: false,
        eligibilityStatus: "EXCLUDED_STOCKOUT",
      },
    });

    const res = await getRecommendationExplanation(testKitchenIdA, testDishIdA, "LUNCH", 150);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.hasEnoughHistory).toBe(false);
    expect(res.data.suggestedKg).toBeNull();
    expect(res.data.eligibleCount).toBe(1);
    expect(res.data.minimumRequired).toBe(3);
    expect(res.data.message).toContain("No numerical suggestion");
    expect(res.data.message).toContain("need at least 3 eligible services");
    expect(res.data.message).toContain("Currently have 1 (need 2 more)");
    expect(res.data.exclusionSummary?.stockoutCount).toBe(1);
    expect(res.data.eligibleObservations).toHaveLength(1);
    expect(res.data.eligibleObservations[0].cookedKg).toBe(20.0);
    expect(res.data.eligibleObservations[0].servedKg).toBe(18.0);
  });

  it("4. With eligible history lists services and matches suggested kg arithmetic exactly", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: {
        id: headCookUserId,
        email: "chef_east@explaintarget.com",
        name: "Chef Maya",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    // Create 3 clean eligible observations for Sambar at LUNCH
    // Service 1: cooked 25, leftover 5 -> served 20, diners 100
    const m1 = await prisma.meal.create({
      data: { kitchenId: testKitchenIdA, date: new Date("2026-11-22T00:00:00Z"), mealType: "LUNCH" },
    });
    await prisma.observation.create({
      data: {
        mealId: m1.id,
        dishId: testDishIdA,
        kitchenId: testKitchenIdA,
        actualDiners: 100,
        totalCookedKg: 25.0,
        unservedLeftoverKg: 5.0,
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    // Service 2: cooked 30, leftover 6 -> served 24, diners 120
    const m2 = await prisma.meal.create({
      data: { kitchenId: testKitchenIdA, date: new Date("2026-11-23T00:00:00Z"), mealType: "LUNCH" },
    });
    await prisma.observation.create({
      data: {
        mealId: m2.id,
        dishId: testDishIdA,
        kitchenId: testKitchenIdA,
        actualDiners: 120,
        totalCookedKg: 30.0,
        unservedLeftoverKg: 6.0,
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    // Service 3: cooked 20, leftover 2 -> served 18, diners 80
    const m3 = await prisma.meal.create({
      data: { kitchenId: testKitchenIdA, date: new Date("2026-11-24T00:00:00Z"), mealType: "LUNCH" },
    });
    await prisma.observation.create({
      data: {
        mealId: m3.id,
        dishId: testDishIdA,
        kitchenId: testKitchenIdA,
        actualDiners: 80,
        totalCookedKg: 20.0,
        unservedLeftoverKg: 2.0,
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    // Total served = 20 + 24 + 18 = 62.0 kg
    // Total diners = 100 + 120 + 80 = 300 diners
    // Rate = 62 / 300 = 0.206666... kg/diner
    // Target for 150 expected diners = (62 / 300) * 150 = 31.0 kg
    const expectedDiners = 150;
    const res = await getRecommendationExplanation(testKitchenIdA, testDishIdA, "LUNCH", expectedDiners);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.hasEnoughHistory).toBe(true);
    expect(res.data.dishName).toBe("Sambar");
    expect(res.data.eligibleCount).toBe(3);
    expect(res.data.totalServedKg).toBe(62.0);
    expect(res.data.totalDiners).toBe(300);

    // Exact arithmetic match
    expect(res.data.suggestedKg).toBeCloseTo(31.0, 2);
    expect(res.data.servedPerDinerRate).toBeCloseTo(62 / 300, 4);

    // Verify observation list details
    expect(res.data.eligibleObservations).toHaveLength(3);
    const dates = res.data.eligibleObservations.map((o) => o.date);
    expect(dates).toContain("2026-11-22");
    expect(dates).toContain("2026-11-23");
    expect(dates).toContain("2026-11-24");
  });

  it("5. Multi-tenant and scope isolation: does not pool other kitchens or mealTypes", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: {
        id: headCookUserId,
        email: "chef_east@explaintarget.com",
        name: "Chef Maya",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    // Create 3 DINNER observations for Kitchen A
    for (let i = 1; i <= 3; i++) {
      const meal = await prisma.meal.create({
        data: { kitchenId: testKitchenIdA, date: new Date(`2026-11-1${i}T00:00:00Z`), mealType: "DINNER" },
      });
      await prisma.observation.create({
        data: {
          mealId: meal.id,
          dishId: testDishIdA,
          kitchenId: testKitchenIdA,
          actualDiners: 100,
          totalCookedKg: 30.0,
          unservedLeftoverKg: 5.0,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "ELIGIBLE",
        },
      });
    }

    // Query for LUNCH on Kitchen A -> must return 0 eligible count and insufficient history
    const lunchRes = await getRecommendationExplanation(testKitchenIdA, testDishIdA, "LUNCH", 100);
    expect(lunchRes.success).toBe(true);
    if (!lunchRes.success) return;

    expect(lunchRes.data.eligibleCount).toBe(0);
    expect(lunchRes.data.hasEnoughHistory).toBe(false);
    expect(lunchRes.data.suggestedKg).toBeNull();
  });
});
