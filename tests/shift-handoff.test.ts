import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { getShiftHandoffSummary } from "../src/server/actions/shift-handoff";
import { normalizeServiceDate } from "../src/lib/domain/date";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";

// Mock session module to test kitchen access
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireKitchenAccess, getSessionUser } from "../src/lib/auth/session";

describe("Wave 1 / T1-B: Shift Handoff Summary", () => {
  const testKitchenIdA = "test-handoff-kitchen-a";
  const testKitchenIdB = "test-handoff-kitchen-b";
  const testContractorId = "test-handoff-contractor";
  const testUserId = "test-handoff-user-hc";
  const testDate = "2026-11-24";

  let testDishId1: string;
  let testDishId2: string;

  beforeEach(async () => {
    vi.mocked(requireKitchenAccess).mockImplementation(async (kitchenId: string) => {
      if (kitchenId === "unauthorized-kitchen") {
        return { success: false, error: "Access denied", statusCode: 403 };
      }
      return {
        success: true,
        user: {
          id: testUserId,
          email: "headcook@cookcue.com",
          name: "Chef Maya",
          role: "HEAD_COOK",
          contractorId: testContractorId,
          kitchenId,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 3600000,
        },
      };
    });

    vi.mocked(getSessionUser).mockResolvedValue({
      id: testUserId,
      email: "headcook@cookcue.com",
      name: "Chef Maya",
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
    await prisma.user.deleteMany({
      where: { id: testUserId },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: testContractorId },
    }).catch(() => {});

    // Create contractor, kitchens, user, and sample dishes
    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorId,
        code: ctrCode,
        name: "Handoff Test Contractor",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdA,
        name: "Handoff Central Kitchen",
        contractorId: testContractorId,
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdB,
        name: "Handoff Secondary Kitchen",
        contractorId: testContractorId,
      },
    });

    await prisma.user.create({
      data: {
        id: testUserId,
        email: "headcook@cookcue.com",
        name: "Chef Maya",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        status: "ACTIVE",
      },
    });

    const dish1 = await prisma.dish.create({
      data: {
        name: "Pulao Rice",
        kitchenId: testKitchenIdA,
        unit: "kg",
      },
    });
    testDishId1 = dish1.id;

    const dish2 = await prisma.dish.create({
      data: {
        name: "Paneer Curry",
        kitchenId: testKitchenIdA,
        unit: "kg",
      },
    });
    testDishId2 = dish2.id;
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
    await prisma.user.deleteMany({
      where: { id: testUserId },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: testContractorId },
    }).catch(() => {});
  });

  it("returns an honest empty state when no meal service exists for date/mealType", async () => {
    const res = await getShiftHandoffSummary(testKitchenIdA, "2026-11-29", "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.kitchenId).toBe(testKitchenIdA);
    expect(res.data.kitchenName).toBe("Handoff Central Kitchen");
    expect(res.data.mealExists).toBe(false);
    expect(res.data.mealId).toBeNull();
    expect(res.data.planStatus).toBe("NO_PLAN");
    expect(res.data.expectedDiners).toBeNull();
    expect(res.data.closeoutStatus).toBe("NOT_STARTED");
    expect(res.data.actualDiners).toBeNull();
    expect(res.data.totalCookedKg).toBeNull();
    expect(res.data.totalLeftoverKg).toBeNull();
    expect(res.data.totalServedKg).toBeNull();
    expect(res.data.stockoutDishes).toEqual([]);
    expect(res.data.links.morning).toContain(`/kitchen/${testKitchenIdA}/morning`);
    expect(res.data.links.closeout).toContain(`/kitchen/${testKitchenIdA}/closeout`);
  });

  it("shows approved morning plan and closeout actuals when present", async () => {
    const serviceDate = normalizeServiceDate(testDate);
    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        date: serviceDate,
        mealType: "LUNCH",
      },
    });

    const plan = await prisma.cookingPlan.create({
      data: {
        mealId: meal.id,
        kitchenId: testKitchenIdA,
        expectedDiners: 150,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApproverId: testUserId,
        firstApprovedAt: new Date(Date.now() - 7200000),
      },
    });

    await prisma.planItem.create({
      data: {
        planId: plan.id,
        dishId: testDishId1,
        approvedKg: 35,
        recommendedKg: 35,
      },
    });

    await prisma.planItem.create({
      data: {
        planId: plan.id,
        dishId: testDishId2,
        approvedKg: 25,
        recommendedKg: 25,
      },
    });

    // Create closeout observations (Dish 1 normal, Dish 2 stockout!)
    await prisma.observation.create({
      data: {
        mealId: meal.id,
        dishId: testDishId1,
        kitchenId: testKitchenIdA,
        actualDiners: 148,
        totalCookedKg: 35.0,
        unservedLeftoverKg: 3.0,
        isStockout: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });

    await prisma.observation.create({
      data: {
        mealId: meal.id,
        dishId: testDishId2,
        kitchenId: testKitchenIdA,
        actualDiners: 148,
        totalCookedKg: 25.0,
        unservedLeftoverKg: 0.0,
        isStockout: true, // Food ran out!
        eligibilityStatus: "EXCLUDED",
      },
    });

    const res = await getShiftHandoffSummary(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.mealExists).toBe(true);
    expect(res.data.planStatus).toBe("APPROVED");
    expect(res.data.expectedDiners).toBe(150);
    expect(res.data.planItemsCount).toBe(2);
    expect(res.data.approvedBy).toBe("Chef Maya");

    expect(res.data.closeoutStatus).toBe("SUBMITTED");
    expect(res.data.actualDiners).toBe(148);
    // Cooked: 35 + 25 = 60 kg; Leftover: 3 + 0 = 3 kg; Served: 60 - 3 = 57 kg
    expect(res.data.totalCookedKg).toBe(60);
    expect(res.data.totalLeftoverKg).toBe(3);
    expect(res.data.totalServedKg).toBe(57);

    // Stockouts detected
    expect(res.data.stockoutDishes).toContain("Paneer Curry");
    expect(res.data.stockoutDishes).not.toContain("Pulao Rice");
  });

  it("defaults date to today and mealType according to time-of-day heuristic if omitted", async () => {
    const res = await getShiftHandoffSummary(testKitchenIdA);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    expect(res.data.date).toBe(todayStr);
    expect(["BREAKFAST", "LUNCH", "DINNER"]).toContain(res.data.mealType);
  });

  it("denies cross-kitchen access with 403 Forbidden", async () => {
    const res = await getShiftHandoffSummary("unauthorized-kitchen", testDate, "LUNCH");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("Access denied");
      expect(res.statusCode).toBe(403);
    }
  });
});
