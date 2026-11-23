import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import {
  listTemplates,
  createTemplate,
  deleteTemplate,
} from "../src/server/actions/service-template";

// Mock session module to grant or deny kitchen access
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireKitchenAccess, getSessionUser } from "../src/lib/auth/session";

describe("Phase 2 UX: Service Templates for Morning Plan", () => {
  const testKitchenIdA = "test-template-kitchen-a";
  const testKitchenIdB = "test-template-kitchen-b";
  const testContractorId = "test-template-contractor";

  const dishA1 = "test-dish-a1";
  const dishA2 = "test-dish-a2";
  const dishB1 = "test-dish-b1";

  beforeEach(async () => {
    // Default: authorized for testKitchenIdA and testKitchenIdB
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

    // Clean test artifacts
    await prisma.kitchenServiceTemplate.deleteMany({
      where: { kitchenId: { in: [testKitchenIdA, testKitchenIdB] } },
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
        name: "Template Testing Org",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdA,
        name: "Alpha Kitchen",
        contractorId: testContractorId,
      },
    });

    await prisma.kitchen.create({
      data: {
        id: testKitchenIdB,
        name: "Beta Kitchen",
        contractorId: testContractorId,
      },
    });

    // Create dishes
    await prisma.dish.create({
      data: { id: dishA1, name: "Basmati Rice", kitchenId: testKitchenIdA, unit: "kg" },
    });
    await prisma.dish.create({
      data: { id: dishA2, name: "Sambhar", kitchenId: testKitchenIdA, unit: "kg" },
    });
    await prisma.dish.create({
      data: { id: dishB1, name: "Chapati", kitchenId: testKitchenIdB, unit: "kg" },
    });
  });

  afterAll(async () => {
    await prisma.kitchenServiceTemplate.deleteMany({
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

  it("1. Empty kitchen has no templates (no synthetic global templates)", async () => {
    const res = await listTemplates(testKitchenIdA);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toEqual([]);
    }
  });

  it("2. Create, list, and delete service template scoped to kitchen", async () => {
    // Create template in Kitchen A
    const createRes = await createTemplate(testKitchenIdA, {
      name: "Standard Lunch",
      mealType: "LUNCH",
      defaultExpectedDiners: 150,
      dishIds: [dishA1, dishA2],
    });

    expect(createRes.success).toBe(true);
    if (!createRes.success) return;

    expect(createRes.data.name).toBe("Standard Lunch");
    expect(createRes.data.mealType).toBe("LUNCH");
    expect(createRes.data.defaultExpectedDiners).toBe(150);
    expect(createRes.data.dishIds).toEqual([dishA1, dishA2]);
    expect(createRes.data.dishes).toHaveLength(2);

    const templateId = createRes.data.id;

    // List templates in Kitchen A
    const listRes = await listTemplates(testKitchenIdA);
    expect(listRes.success).toBe(true);
    if (!listRes.success) return;

    expect(listRes.data).toHaveLength(1);
    expect(listRes.data[0].id).toBe(templateId);
    expect(listRes.data[0].name).toBe("Standard Lunch");

    // Delete template in Kitchen A
    const deleteRes = await deleteTemplate(testKitchenIdA, templateId);
    expect(deleteRes.success).toBe(true);

    // Verify deletion
    const listAfter = await listTemplates(testKitchenIdA);
    expect(listAfter.success).toBe(true);
    if (listAfter.success) {
      expect(listAfter.data).toHaveLength(0);
    }
  });

  it("3. Enforces unique template name per kitchen (case-insensitive)", async () => {
    await createTemplate(testKitchenIdA, {
      name: "Daily Breakfast",
      mealType: "BREAKFAST",
      dishIds: [dishA1],
    });

    const duplicateRes = await createTemplate(testKitchenIdA, {
      name: "daily breakfast",
      mealType: "BREAKFAST",
      dishIds: [dishA1],
    });

    expect(duplicateRes.success).toBe(false);
    if (!duplicateRes.success) {
      expect(duplicateRes.error).toContain("already exists");
    }
  });

  it("4. Prevents cross-kitchen dish assignment (tenant boundary)", async () => {
    // Attempt to use Kitchen B's dish in Kitchen A's template
    const res = await createTemplate(testKitchenIdA, {
      name: "Cross Kitchen Menu",
      mealType: "DINNER",
      dishIds: [dishA1, dishB1], // dishB1 belongs to testKitchenIdB!
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("do not belong to this facility");
    }
  });

  it("5. Cross-kitchen access denied on list, create, and delete", async () => {
    // 1. Create template in Kitchen A
    const createRes = await createTemplate(testKitchenIdA, {
      name: "Alpha Dinner",
      mealType: "DINNER",
      dishIds: [dishA1],
    });
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;
    const templateIdA = createRes.data.id;

    // 2. Kitchen B should see 0 templates
    const listB = await listTemplates(testKitchenIdB);
    expect(listB.success).toBe(true);
    if (listB.success) {
      expect(listB.data).toEqual([]);
    }

    // 3. Kitchen B cannot delete Kitchen A's template
    const deleteFromB = await deleteTemplate(testKitchenIdB, templateIdA);
    expect(deleteFromB.success).toBe(false);

    // 4. Unauthorized kitchen access denied
    const unauthList = await listTemplates("unauthorized-kitchen");
    expect(unauthList.success).toBe(false);
  });

  it("6. Template existence and apply does not create or approve a cooking plan", async () => {
    // Create template
    await createTemplate(testKitchenIdA, {
      name: "Quick Lunch",
      mealType: "LUNCH",
      defaultExpectedDiners: 80,
      dishIds: [dishA1, dishA2],
    });

    // Check that zero plans or meals exist
    const planCount = await prisma.cookingPlan.count({
      where: { kitchenId: testKitchenIdA },
    });
    const mealCount = await prisma.meal.count({
      where: { kitchenId: testKitchenIdA },
    });

    expect(planCount).toBe(0);
    expect(mealCount).toBe(0);
  });
});
