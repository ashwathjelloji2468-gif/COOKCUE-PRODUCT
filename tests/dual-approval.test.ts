import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import {
  approveCookingPlan,
  modifyCookingPlanQuantities,
  getCookingPlanForMeal,
} from "../src/server/actions/morning-plan";
import { getApprovedPlanForMeal, submitCloseout } from "../src/server/actions/closeout";

// Mock session module to simulate different roles
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireKitchenAccess, getSessionUser } from "../src/lib/auth/session";

describe("Head Cook Plan Approval Policy (Option B: Single Signature)", () => {
  const testKitchenId = "test-head-cook-approval-kitchen";
  const testContractorId = "test-head-cook-approval-contractor";
  const testMealType = "LUNCH";
  const testDate = "2026-11-25";

  let testMealId: string;
  let testDishId: string;
  let headCookUser: { id: string; email: string; name: string; role: "HEAD_COOK"; kitchenId: string };
  let staffUser: { id: string; email: string; name: string; role: "KITCHEN_STAFF"; kitchenId: string };
  let founderUser: { id: string; email: string; name: string; role: "FOUNDER" };

  beforeEach(async () => {
    // 1. Clean previous test artifacts
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.planOverrideAudit.deleteMany({ where: { planItem: { plan: { kitchenId: testKitchenId } } } }).catch(() => {});
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        OR: [
          { kitchenId: testKitchenId },
          { id: { in: ["hc-user-head-cook", "hc-user-staff", "hc-user-founder"] } },
        ],
      },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: testKitchenId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

    // 2. Provision contractor & kitchen
    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: { id: testContractorId, code: ctrCode, name: "Head Cook Org", status: "ACTIVE" },
    });

    await prisma.kitchen.create({
      data: { id: testKitchenId, contractorId: testContractorId, name: "Head Cook Kitchen Alpha", status: "ACTIVE" },
    });

    // 3. Create Users
    const u1 = await prisma.user.create({
      data: {
        id: "hc-user-head-cook",
        email: "headcook@cookcue.test",
        name: "Chef Rajesh",
        role: "HEAD_COOK",
        status: "ACTIVE",
        kitchenId: testKitchenId,
      },
    });
    headCookUser = {
      id: u1.id,
      email: u1.email,
      name: u1.name!,
      role: "HEAD_COOK",
      kitchenId: testKitchenId,
    };

    const u2 = await prisma.user.create({
      data: {
        id: "hc-user-staff",
        email: "staff@cookcue.test",
        name: "Staff Rohan",
        role: "KITCHEN_STAFF",
        status: "ACTIVE",
        kitchenId: testKitchenId,
      },
    });
    staffUser = {
      id: u2.id,
      email: u2.email,
      name: u2.name!,
      role: "KITCHEN_STAFF",
      kitchenId: testKitchenId,
    };

    const u3 = await prisma.user.create({
      data: {
        id: "hc-user-founder",
        email: "founder@cookcue.test",
        name: "Platform Founder",
        role: "FOUNDER",
        status: "ACTIVE",
      },
    });
    founderUser = {
      id: u3.id,
      email: u3.email,
      name: u3.name!,
      role: "FOUNDER",
    };

    // 4. Provision Dish and Meal
    const dish = await prisma.dish.create({
      data: { kitchenId: testKitchenId, name: "Basmati Rice", unit: "kg" },
    });
    testDishId = dish.id;

    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenId,
        mealType: testMealType,
        date: new Date(`${testDate}T00:00:00.000Z`),
        expectedDiners: 100,
      },
    });
    testMealId = meal.id;
  });

  it("1. Rejects approval submission by non-approver role (KITCHEN_STAFF)", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: staffUser.id,
        email: staffUser.email,
        name: staffUser.name,
        role: staffUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const res = await approveCookingPlan(testKitchenId, testMealId, 100, [
      { dishId: testDishId, recommendedKg: 20, approvedKg: 20 },
    ]);

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/Unauthorized/i);
      expect(res.error).toMatch(/Head Cook/i);
    }
  });

  it("2. Head Cook approves plan: single approval transitions DRAFT to APPROVED directly", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const res = await approveCookingPlan(testKitchenId, testMealId, 120, [
      { dishId: testDishId, recommendedKg: 25.0, approvedKg: 27.5 },
    ]);

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.status).toBe("APPROVED");
    }

    const planInDb = await prisma.cookingPlan.findUnique({
      where: { mealId: testMealId },
      include: { firstApprover: true },
    });

    expect(planInDb).not.toBeNull();
    expect(planInDb?.status).toBe("APPROVED");
    expect(planInDb?.approvalStatus).toBe("APPROVED");
    expect(planInDb?.firstApproverId).toBe(headCookUser.id);
    expect(planInDb?.firstApprovedAt).toBeInstanceOf(Date);
    expect(planInDb?.secondApproverId).toBeNull();
    expect(planInDb?.expectedDiners).toBe(120);

    // Override audit recorded for Head Cook quantity change
    const overrideAudit = await prisma.planOverrideAudit.findFirst({
      where: { planItem: { planId: planInDb!.id } },
    });
    expect(overrideAudit).not.toBeNull();
    expect(overrideAudit?.recommendedKg).toBe(25.0);
    expect(overrideAudit?.newApprovedKg).toBe(27.5);
    expect(overrideAudit?.approvedByUserId).toBe(headCookUser.id);
  });

  it("3. Founder override can also approve the plan directly in a single signature", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: founderUser.id,
        email: founderUser.email,
        name: founderUser.name,
        role: founderUser.role,
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const res = await approveCookingPlan(testKitchenId, testMealId, 100, [
      { dishId: testDishId, recommendedKg: 20, approvedKg: 20 },
    ]);

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.status).toBe("APPROVED");
    }

    const planInDb = await prisma.cookingPlan.findUnique({
      where: { mealId: testMealId },
    });
    expect(planInDb?.status).toBe("APPROVED");
    expect(planInDb?.firstApproverId).toBe(founderUser.id);
  });

  it("4. Closeout Gate: Requires APPROVED plan; works immediately after single approval", async () => {
    // A. Attempting closeout when no plan is approved fails
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const unapprovedLoad = await getApprovedPlanForMeal(testKitchenId, testMealType, testDate);
    expect(unapprovedLoad.success).toBe(false);

    // B. Approve plan once as Head Cook
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const approveRes = await approveCookingPlan(testKitchenId, testMealId, 100, [
      { dishId: testDishId, recommendedKg: 20, approvedKg: 20 },
    ]);
    expect(approveRes.success).toBe(true);

    // C. Closeout load attempt now succeeds immediately!
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const approvedLoad = await getApprovedPlanForMeal(testKitchenId, testMealType, testDate);
    expect(approvedLoad.success).toBe(true);
    if (approvedLoad.success) {
      expect(approvedLoad.data.planId).toBeDefined();
      expect(approvedLoad.data.items[0].approvedKg).toBe(20);
    }

    // D. Direct closeout submit succeeds
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: headCookUser.id,
      email: headCookUser.email,
      name: headCookUser.name,
      role: headCookUser.role,
      contractorId: null,
      kitchenId: testKitchenId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    const submitRes = await submitCloseout({
      kitchenId: testKitchenId,
      mealId: testMealId,
      actualDiners: 95,
      items: [{ dishId: testDishId, totalCookedKg: 20, unservedLeftoverKg: 2, isStockout: false, isAbnormal: false }],
    });
    expect(submitRes.success).toBe(true);
  });

  it("5. Modifying quantities after approval reverts plan to DRAFT, requiring Head Cook re-approval", async () => {
    // 1. Initial Head Cook approval
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
    await approveCookingPlan(testKitchenId, testMealId, 100, [
      { dishId: testDishId, recommendedKg: 20, approvedKg: 20 },
    ]);

    // 2. Revise quantities
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
    const reviseRes = await modifyCookingPlanQuantities(testKitchenId, testMealId, 105, [
      { dishId: testDishId, approvedKg: 22 },
    ]);
    expect(reviseRes.success).toBe(true);
    if (reviseRes.success) {
      expect(reviseRes.status).toBe("DRAFT");
    }

    // Database verification: reverted to DRAFT
    const planInDb = await prisma.cookingPlan.findUnique({
      where: { mealId: testMealId },
    });
    expect(planInDb?.status).toBe("DRAFT");
    expect(planInDb?.approvalStatus).toBe("DRAFT");

    // Closeout gate blocks until re-approved
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
    const closeoutAttempt = await getApprovedPlanForMeal(testKitchenId, testMealType, testDate);
    expect(closeoutAttempt.success).toBe(false);

    // 3. Head Cook re-approves
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
    const reApproveRes = await approveCookingPlan(testKitchenId, testMealId, 105, [
      { dishId: testDishId, recommendedKg: 20, approvedKg: 22 },
    ]);
    expect(reApproveRes.success).toBe(true);

    const reApprovedPlan = await prisma.cookingPlan.findUnique({
      where: { mealId: testMealId },
    });
    expect(reApprovedPlan?.status).toBe("APPROVED");
  });

  it("6. Post-Closeout Immutability: Blocks plan modification once closeout is recorded", async () => {
    // 1. Approve plan
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
    await approveCookingPlan(testKitchenId, testMealId, 100, [
      { dishId: testDishId, recommendedKg: 20, approvedKg: 20 },
    ]);

    // 2. Submit Closeout
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: headCookUser.id,
      email: headCookUser.email,
      name: headCookUser.name,
      role: headCookUser.role,
      contractorId: null,
      kitchenId: testKitchenId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });
    await submitCloseout({
      kitchenId: testKitchenId,
      mealId: testMealId,
      actualDiners: 100,
      items: [{ dishId: testDishId, totalCookedKg: 20, unservedLeftoverKg: 1, isStockout: false, isAbnormal: false }],
    });

    // 3. Attempting to approve or modify plan after closeout is strictly rejected
    vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
      success: true,
      user: {
        id: headCookUser.id,
        email: headCookUser.email,
        name: headCookUser.name,
        role: headCookUser.role,
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    const postCloseoutApprove = await approveCookingPlan(testKitchenId, testMealId, 100, [
      { dishId: testDishId, recommendedKg: 20, approvedKg: 25 },
    ]);
    expect(postCloseoutApprove.success).toBe(false);
    if (!postCloseoutApprove.success) {
      expect(postCloseoutApprove.error).toContain("closeout has already been recorded");
    }
  });
});
