import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { getServiceDiary } from "../src/server/actions/service-diary";
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

describe("Phase D: Kitchen Service Diary", () => {
  const testKitchenIdA = "test-diary-kitchen-a";
  const testKitchenIdB = "test-diary-kitchen-b";
  const testContractorId = "test-diary-contractor";
  const testUserId = "test-diary-user-hc";
  const testDate = "2026-11-22";

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
      id: testUserId,
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
    await prisma.user.deleteMany({
      where: { id: testUserId },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: testContractorId },
    }).catch(() => {});

    // Create contractor, kitchens, and user
    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorId,
        code: ctrCode,
        name: "Service Diary Contractor",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdA,
        name: "Diary Central Kitchen",
        contractorId: testContractorId,
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdB,
        name: "Diary Secondary Kitchen",
        contractorId: testContractorId,
      },
    });

    await prisma.user.create({
      data: {
        id: testUserId,
        email: "headcook@cookcue.com",
        name: "Chef Raj",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        status: "ACTIVE",
      },
    });

    const dish1 = await prisma.dish.create({
      data: {
        name: "Jeera Rice",
        kitchenId: testKitchenIdA,
        unit: "kg",
      },
    });
    testDishId1 = dish1.id;

    const dish2 = await prisma.dish.create({
      data: {
        name: "Dal Tadka",
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

  it("returns empty diary events when no meal exists for date", async () => {
    const res = await getServiceDiary(testKitchenIdA, "2026-11-25", "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.kitchenId).toBe(testKitchenIdA);
    expect(res.data.kitchenName).toBe("Diary Central Kitchen");
    expect(res.data.mealExists).toBe(false);
    expect(res.data.planStatus).toBe("NO_PLAN");
    expect(res.data.closeoutStatus).toBe("NOT_STARTED");
    expect(res.data.events).toEqual([]);
  });

  it("shows PLAN_CREATED and PLAN_APPROVED when plan is approved", async () => {
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
        firstApprovedAt: new Date(Date.now() - 3600000), // 1 hour ago
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
      },
    });

    await prisma.planItem.create({
      data: {
        planId: plan.id,
        dishId: testDishId1,
        approvedKg: 30,
        recommendedKg: 30,
      },
    });

    const res = await getServiceDiary(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.mealExists).toBe(true);
    expect(res.data.planStatus).toBe("APPROVED");
    expect(res.data.closeoutStatus).toBe("NOT_STARTED");

    const eventTypes = res.data.events.map((e) => e.type);
    expect(eventTypes).toContain("PLAN_CREATED");
    expect(eventTypes).toContain("PLAN_APPROVED");

    const approvedEvent = res.data.events.find((e) => e.type === "PLAN_APPROVED");
    expect(approvedEvent?.actor).toBe("Chef Raj");
    expect(approvedEvent?.detail).toContain("150 diners");
  });

  it("shows CLOSEOUT_SUBMITTED, STOCKOUT, and ELIGIBILITY_SUMMARY when closeout is recorded", async () => {
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
        expectedDiners: 120,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApproverId: testUserId,
        firstApprovedAt: new Date(Date.now() - 14400000),
        createdAt: new Date(Date.now() - 18000000),
      },
    });

    await prisma.planItem.create({
      data: {
        planId: plan.id,
        dishId: testDishId1,
        approvedKg: 25,
        recommendedKg: 25,
      },
    });

    // Create 2 observations: 1 eligible normal, 1 with stockout
    await prisma.observation.create({
      data: {
        mealId: meal.id,
        dishId: testDishId1,
        kitchenId: testKitchenIdA,
        actualDiners: 118,
        totalCookedKg: 25.0,
        unservedLeftoverKg: 1.5,
        isStockout: false,
        eligibilityStatus: "ELIGIBLE",
        createdAt: new Date(Date.now() - 7200000),
      },
    });

    await prisma.observation.create({
      data: {
        mealId: meal.id,
        dishId: testDishId2,
        kitchenId: testKitchenIdA,
        actualDiners: 118,
        totalCookedKg: 18.0,
        unservedLeftoverKg: 0.0,
        isStockout: true, // Ran out!
        eligibilityStatus: "EXCLUDED_STOCKOUT",
        createdAt: new Date(Date.now() - 7200000),
      },
    });

    const res = await getServiceDiary(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.closeoutStatus).toBe("SUBMITTED");
    const eventTypes = res.data.events.map((e) => e.type);

    expect(eventTypes).toContain("PLAN_CREATED");
    expect(eventTypes).toContain("PLAN_APPROVED");
    expect(eventTypes).toContain("CLOSEOUT_SUBMITTED");
    expect(eventTypes).toContain("STOCKOUT");
    expect(eventTypes).toContain("ELIGIBILITY_SUMMARY");

    const stockoutEvent = res.data.events.find((e) => e.type === "STOCKOUT");
    expect(stockoutEvent?.detail).toContain("Dal Tadka");

    const eligibilityEvent = res.data.events.find((e) => e.type === "ELIGIBILITY_SUMMARY");
    expect(eligibilityEvent?.detail).toContain("1 observations qualifying");
  });

  it("sorts events in chronological order (earliest to latest)", async () => {
    const serviceDate = normalizeServiceDate(testDate);
    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        date: serviceDate,
        mealType: "LUNCH",
      },
    });

    const t0 = new Date("2026-11-22T08:00:00Z");
    const t1 = new Date("2026-11-22T09:30:00Z");
    const t2 = new Date("2026-11-22T14:15:00Z");

    await prisma.cookingPlan.create({
      data: {
        mealId: meal.id,
        kitchenId: testKitchenIdA,
        expectedDiners: 100,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApproverId: testUserId,
        firstApprovedAt: t1,
        createdAt: t0,
      },
    });

    await prisma.observation.create({
      data: {
        mealId: meal.id,
        dishId: testDishId1,
        kitchenId: testKitchenIdA,
        actualDiners: 98,
        totalCookedKg: 20.0,
        unservedLeftoverKg: 1.0,
        isStockout: false,
        eligibilityStatus: "ELIGIBLE",
        createdAt: t2,
      },
    });

    const res = await getServiceDiary(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    const timestamps = res.data.events.map((e) => new Date(e.timestamp).getTime());
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i + 1]);
    }
  });

  it("denies cross-kitchen access with 403 Forbidden", async () => {
    const res = await getServiceDiary("unauthorized-kitchen", testDate, "LUNCH");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("Access denied");
      expect(res.statusCode).toBe(403);
    }
  });
});
