import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import { getStaffBoardPrintData } from "../src/server/actions/staff-board";

// Mock session module to test kitchen access guards
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireKitchenAccess, getSessionUser } from "../src/lib/auth/session";

describe("Wave 2 / T2-C: Staff Board Print & Share Targets", () => {
  const testKitchenIdA = "test-print-kitchen-a";
  const testKitchenIdB = "test-print-kitchen-b";
  const testContractorId = "test-print-contractor";
  const testDate = "2026-11-29";

  let headCookUserId: string;
  let testDishId1: string;
  let testDishId2: string;

  beforeEach(async () => {
    // 1. Cleanup previous test records
    await prisma.planOverrideAudit.deleteMany({
      where: { planItem: { plan: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } } } },
    }).catch(() => {});
    await prisma.planItem.deleteMany({
      where: { plan: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } } },
    }).catch(() => {});
    await prisma.cookingPlan.deleteMany({
      where: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } },
    }).catch(() => {});
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
    await prisma.user.deleteMany({
      where: { id: "print-head-cook-user" },
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
      data: { id: testContractorId, code: ctrCode, name: "Print Catering Org", status: "ACTIVE" },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdA,
        contractorId: testContractorId,
        name: "North Campus Dining",
        location: "Central Pavilion",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdB,
        contractorId: testContractorId,
        name: "South Campus Dining",
        location: "Tower 2",
        status: "ACTIVE",
      },
    });

    // 3. Create Head Cook User
    const cook = await prisma.user.create({
      data: {
        id: "print-head-cook-user",
        email: "headcook@printtest.com",
        name: "Chef Vikram",
        role: "HEAD_COOK",
        kitchenId: testKitchenIdA,
        code: "USR-000771",
      },
    });
    headCookUserId = cook.id;

    // 4. Provision Dishes for Kitchen A
    const d1 = await prisma.dish.create({
      data: { kitchenId: testKitchenIdA, name: "Basmati Steamed Rice", unit: "kg" },
    });
    const d2 = await prisma.dish.create({
      data: { kitchenId: testKitchenIdA, name: "Yellow Dal Fry", unit: "kg" },
    });
    testDishId1 = d1.id;
    testDishId2 = d2.id;
  });

  it("1. Denies access when cross-kitchen check fails or user is unauthenticated", async () => {
    // A. Unauthenticated user
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: false,
      error: "Authentication required",
      statusCode: 401,
    });

    const unauthRes = await getStaffBoardPrintData(testKitchenIdA, testDate, "LUNCH");
    expect(unauthRes.success).toBe(false);
    expect(unauthRes.statusCode).toBe(401);

    // B. Cross-kitchen denied
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: false,
      error: "Forbidden: cross-kitchen access denied",
      statusCode: 403,
    });

    const crossRes = await getStaffBoardPrintData(testKitchenIdB, testDate, "LUNCH");
    expect(crossRes.success).toBe(false);
    expect(crossRes.statusCode).toBe(403);
    expect(crossRes.error).toContain("cross-kitchen");
  });

  it("2. Returns honest empty/unapproved state when no meal or plan exists", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUserId,
        email: "headcook@printtest.com",
        name: "Chef Vikram",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const res = await getStaffBoardPrintData(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.kitchenId).toBe(testKitchenIdA);
    expect(res.data.kitchenName).toBe("North Campus Dining");
    expect(res.data.isApproved).toBe(false);
    expect(res.data.items).toEqual([]);
    expect(res.data.expectedDiners).toBeNull();
    expect(res.data.approverName).toBeNull();
  });

  it("3. Returns honest empty/unapproved state when plan is in DRAFT state", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUserId,
        email: "headcook@printtest.com",
        name: "Chef Vikram",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "LUNCH",
        date: new Date(`${testDate}T00:00:00.000Z`),
        expectedDiners: 140,
      },
    });

    const draftPlan = await prisma.cookingPlan.create({
      data: {
        mealId: meal.id,
        kitchenId: testKitchenIdA,
        expectedDiners: 140,
        status: "DRAFT",
        approvalStatus: "DRAFT",
      },
    });

    await prisma.planItem.create({
      data: {
        planId: draftPlan.id,
        dishId: testDishId1,
        recommendedKg: 28.0,
        approvedKg: null,
      },
    });

    const res = await getStaffBoardPrintData(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    // Never releases draft targets on print view
    expect(res.data.isApproved).toBe(false);
    expect(res.data.items).toHaveLength(0);
    expect(res.data.expectedDiners).toBe(140);
  });

  it("4. Lists official production targets when cooking plan is APPROVED", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUserId,
        email: "headcook@printtest.com",
        name: "Chef Vikram",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const approvalTime = new Date("2026-11-29T08:30:00.000Z");

    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "LUNCH",
        date: new Date(`${testDate}T00:00:00.000Z`),
        expectedDiners: 180,
      },
    });

    const approvedPlan = await prisma.cookingPlan.create({
      data: {
        mealId: meal.id,
        kitchenId: testKitchenIdA,
        expectedDiners: 180,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApproverId: headCookUserId,
        firstApprovedAt: approvalTime,
        instructions: "Prepare mild spice for pavilion guests. Keep rice warm in insulated cambros.",
      },
    });

    // Create 2 items
    await prisma.planItem.create({
      data: {
        planId: approvedPlan.id,
        dishId: testDishId1,
        recommendedKg: 35.0,
        approvedKg: 36.5,
      },
    });

    await prisma.planItem.create({
      data: {
        planId: approvedPlan.id,
        dishId: testDishId2,
        recommendedKg: 22.0,
        approvedKg: 24.0,
      },
    });

    const res = await getStaffBoardPrintData(testKitchenIdA, testDate, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.isApproved).toBe(true);
    expect(res.data.kitchenName).toBe("North Campus Dining");
    expect(res.data.location).toBe("Central Pavilion");
    expect(res.data.mealType).toBe("LUNCH");
    expect(res.data.expectedDiners).toBe(180);
    expect(res.data.approverName).toBe("Chef Vikram");
    expect(res.data.approverRole).toBe("HEAD_COOK");
    expect(res.data.approvedAt).toBe(approvalTime.toISOString());
    expect(res.data.instructions).toContain("insulated cambros");

    // Items list verification: ordered alphabetically by dish name
    expect(res.data.items).toHaveLength(2);
    expect(res.data.items[0]).toEqual({
      dishId: testDishId1,
      dishName: "Basmati Steamed Rice",
      unit: "kg",
      approvedKg: 36.5,
      recommendedKg: 35.0,
      allergenTags: [],
      menuCycleLabel: null,
    });
    expect(res.data.items[1]).toEqual({
      dishId: testDishId2,
      dishName: "Yellow Dal Fry",
      unit: "kg",
      approvedKg: 24.0,
      recommendedKg: 22.0,
      allergenTags: [],
      menuCycleLabel: null,
    });
  });

  it("5. Respects distinct service mealType and date filters", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: {
        id: headCookUserId,
        email: "headcook@printtest.com",
        name: "Chef Vikram",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    // Dinner on a different date
    const dinnerDate = "2026-11-30";
    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "DINNER",
        date: new Date(`${dinnerDate}T00:00:00.000Z`),
        expectedDiners: 95,
      },
    });

    const dinnerPlan = await prisma.cookingPlan.create({
      data: {
        mealId: meal.id,
        kitchenId: testKitchenIdA,
        expectedDiners: 95,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApproverId: headCookUserId,
        firstApprovedAt: new Date("2026-11-30T16:00:00.000Z"),
      },
    });

    await prisma.planItem.create({
      data: {
        planId: dinnerPlan.id,
        dishId: testDishId1,
        approvedKg: 20.0,
        recommendedKg: 19.0,
      },
    });

    // Querying for LUNCH on that date returns unapproved (no plan for lunch)
    const lunchRes = await getStaffBoardPrintData(testKitchenIdA, dinnerDate, "LUNCH");
    expect(lunchRes.success).toBe(true);
    if (lunchRes.success) {
      expect(lunchRes.data.isApproved).toBe(false);
      expect(lunchRes.data.items).toHaveLength(0);
    }

    // Querying for DINNER returns the approved dinner targets
    const dinnerRes = await getStaffBoardPrintData(testKitchenIdA, dinnerDate, "DINNER");
    expect(dinnerRes.success).toBe(true);
    if (dinnerRes.success) {
      expect(dinnerRes.data.isApproved).toBe(true);
      expect(dinnerRes.data.mealType).toBe("DINNER");
      expect(dinnerRes.data.expectedDiners).toBe(95);
      expect(dinnerRes.data.items).toHaveLength(1);
      expect(dinnerRes.data.items[0].approvedKg).toBe(20.0);
    }
  });
});
