import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import { normalizeServiceDate, toServiceDateString } from "../src/lib/domain/date";
import {
  createIndentFromApprovedPlan,
  getIndent,
  listIndents,
  markIndentRequested,
  cancelIndent,
} from "../src/server/actions/indents";

// Mock session authentication
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
  };
});

import { requireKitchenAccess } from "../src/lib/auth/session";

describe("WAVE 3 / T3-D — Cooking Plan -> Procurement Indent (Minimal)", () => {
  const testContractorId = "test-indent-contractor";
  const testKitchenIdA = "test-indent-kitchen-a";
  const testKitchenIdB = "test-indent-kitchen-b";
  const testUserId = "test-indent-head-cook";

  const todayStr = toServiceDateString(new Date());
  const todayMidnight = normalizeServiceDate(todayStr);

  let mealDraftId: string;
  let mealApprovedId: string;
  let dish1Id: string;
  let dish2Id: string;
  let createdIndentId: string;

  beforeAll(async () => {
    const kIds = [testKitchenIdA, testKitchenIdB];
    await prisma.procurementIndentLine.deleteMany({
      where: { indent: { kitchenId: { in: kIds } } },
    }).catch(() => {});
    await prisma.procurementIndent.deleteMany({
      where: { kitchenId: { in: kIds } },
    }).catch(() => {});
    await prisma.planOverrideAudit.deleteMany({
      where: { planItem: { plan: { kitchenId: { in: kIds } } } },
    }).catch(() => {});
    await prisma.planItem.deleteMany({
      where: { plan: { kitchenId: { in: kIds } } },
    }).catch(() => {});
    await prisma.cookingPlan.deleteMany({
      where: { kitchenId: { in: kIds } },
    }).catch(() => {});
    await prisma.meal.deleteMany({
      where: { kitchenId: { in: kIds } },
    }).catch(() => {});
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: kIds } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: testUserId },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: kIds } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: testContractorId },
    }).catch(() => {});

    // Create Contractor & Kitchens
    const code = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorId,
        code,
        name: "Indent Test Catering Org",
        status: "ACTIVE",
        kitchens: {
          create: [
            { id: testKitchenIdA, name: "Indent Test Kitchen A", location: "Block A" },
            { id: testKitchenIdB, name: "Indent Test Kitchen B", location: "Block B" },
          ],
        },
      },
    });

    // Create Test User
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "headcook.indent@test.com",
        name: "Chef Rajan",
        role: "HEAD_COOK",
        kitchenId: testKitchenIdA,
        contractorId: testContractorId,
        status: "ACTIVE",
      },
    });

    // Create Dishes
    const d1 = await prisma.dish.create({
      data: {
        kitchenId: testKitchenIdA,
        name: "Sona Masoori Rice",
        unit: "kg",
        allergenTags: ["GLUTEN"],
        menuCycleLabel: "Week 1 - Mon",
      },
    });
    dish1Id = d1.id;

    const d2 = await prisma.dish.create({
      data: {
        kitchenId: testKitchenIdA,
        name: "Toor Dal Sambhar",
        unit: "kg",
        allergenTags: ["MUSTARD"],
        menuCycleLabel: "Daily Core",
      },
    });
    dish2Id = d2.id;

    // Service 1: Meal with DRAFT cooking plan
    const mDraft = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "BREAKFAST",
        date: todayMidnight,
        expectedDiners: 120,
      },
    });
    mealDraftId = mDraft.id;

    await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenIdA,
        mealId: mealDraftId,
        expectedDiners: 120,
        status: "DRAFT",
        approvalStatus: "DRAFT",
        items: {
          create: [
            { dishId: dish1Id, recommendedKg: 20.0, approvedKg: null },
          ],
        },
      },
    });

    // Service 2: Meal with APPROVED cooking plan
    const mApproved = await prisma.meal.create({
      data: {
        kitchenId: testKitchenIdA,
        mealType: "LUNCH",
        date: todayMidnight,
        expectedDiners: 250,
      },
    });
    mealApprovedId = mApproved.id;

    await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenIdA,
        mealId: mealApprovedId,
        expectedDiners: 250,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApproverId: testUserId,
        firstApprovedAt: new Date(),
        items: {
          create: [
            { dishId: dish1Id, recommendedKg: 45.0, approvedKg: 48.0 },
            { dishId: dish2Id, recommendedKg: 30.0, approvedKg: 32.5 },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    const kIds = [testKitchenIdA, testKitchenIdB];
    await prisma.procurementIndentLine.deleteMany({
      where: { indent: { kitchenId: { in: kIds } } },
    }).catch(() => {});
    await prisma.procurementIndent.deleteMany({
      where: { kitchenId: { in: kIds } },
    }).catch(() => {});
    await prisma.planOverrideAudit.deleteMany({
      where: { planItem: { plan: { kitchenId: { in: kIds } } } },
    }).catch(() => {});
    await prisma.planItem.deleteMany({
      where: { plan: { kitchenId: { in: kIds } } },
    }).catch(() => {});
    await prisma.cookingPlan.deleteMany({
      where: { kitchenId: { in: kIds } },
    }).catch(() => {});
    await prisma.meal.deleteMany({
      where: { kitchenId: { in: kIds } },
    }).catch(() => {});
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: kIds } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: testUserId },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: kIds } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: testContractorId },
    }).catch(() => {});
  });

  it("1. Cannot create indent from unapproved (DRAFT) cooking plan", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: { id: testUserId, email: "headcook.indent@test.com", role: "HEAD_COOK", contractorId: testContractorId, kitchenId: testKitchenIdA },
    } as any);

    const res = await createIndentFromApprovedPlan(testKitchenIdA, mealDraftId);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("unapproved");
    }
  });

  it("2. Cannot create indent when meal service does not exist", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: { id: testUserId, email: "headcook.indent@test.com", role: "HEAD_COOK", contractorId: testContractorId, kitchenId: testKitchenIdA },
    } as any);

    const res = await createIndentFromApprovedPlan(testKitchenIdA, "non-existent-meal-id");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("not found");
    }
  });

  it("3. Creates DRAFT indent from APPROVED plan with matching line targets and tags", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: { id: testUserId, email: "headcook.indent@test.com", role: "HEAD_COOK", contractorId: testContractorId, kitchenId: testKitchenIdA },
    } as any);

    const res = await createIndentFromApprovedPlan(testKitchenIdA, mealApprovedId);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.status).toBe("DRAFT");
      expect(res.indentId).toBeDefined();
      createdIndentId = res.indentId;
    }

    // Verify lines in database
    const lines = await prisma.procurementIndentLine.findMany({
      where: { indentId: createdIndentId },
      orderBy: { sortOrder: "asc" },
    });

    expect(lines).toHaveLength(2);
    // Basmati / Sona Masoori Rice line: approvedKg was 48.0
    const riceLine = lines.find((l) => l.dishId === dish1Id);
    expect(riceLine).toBeDefined();
    expect(riceLine?.dishName).toBe("Sona Masoori Rice");
    expect(riceLine?.targetKg).toBe(48.0);
    expect(riceLine?.unit).toBe("kg");
    expect(riceLine?.allergenTags).toEqual(["GLUTEN"]);
    expect(riceLine?.menuCycleLabel).toBe("Week 1 - Mon");

    // Sambhar line: approvedKg was 32.5
    const sambharLine = lines.find((l) => l.dishId === dish2Id);
    expect(sambharLine).toBeDefined();
    expect(sambharLine?.dishName).toBe("Toor Dal Sambhar");
    expect(sambharLine?.targetKg).toBe(32.5);
    expect(sambharLine?.allergenTags).toEqual(["MUSTARD"]);
    expect(sambharLine?.menuCycleLabel).toBe("Daily Core");
  });

  it("4. Re-calling on an existing DRAFT indent refreshes the targets without duplicating", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: { id: testUserId, email: "headcook.indent@test.com", role: "HEAD_COOK", contractorId: testContractorId, kitchenId: testKitchenIdA },
    } as any);

    const res = await createIndentFromApprovedPlan(testKitchenIdA, mealApprovedId);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.indentId).toBe(createdIndentId);
      expect(res.status).toBe("DRAFT");
    }

    // Count of lines must still be exactly 2
    const count = await prisma.procurementIndentLine.count({
      where: { indentId: createdIndentId },
    });
    expect(count).toBe(2);
  });

  it("5. getIndent returns full details, lines, and creator info", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: { id: testUserId, email: "headcook.indent@test.com", role: "HEAD_COOK", contractorId: testContractorId, kitchenId: testKitchenIdA },
    } as any);

    const res = await getIndent(testKitchenIdA, createdIndentId);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.id).toBe(createdIndentId);
      expect(res.data.mealType).toBe("LUNCH");
      expect(res.data.status).toBe("DRAFT");
      expect(res.data.kitchenName).toBe("Indent Test Kitchen A");
      expect(res.data.createdByName).toBe("Chef Rajan");
      expect(res.data.lines).toHaveLength(2);
      expect(res.data.requestedAt).toBeNull();
    }
  });

  it("6. markIndentRequested updates status to REQUESTED and records timestamp", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: { id: testUserId, email: "headcook.indent@test.com", role: "HEAD_COOK", contractorId: testContractorId, kitchenId: testKitchenIdA },
    } as any);

    const res = await markIndentRequested(testKitchenIdA, createdIndentId);
    expect(res.success).toBe(true);

    const check = await getIndent(testKitchenIdA, createdIndentId);
    expect(check.success).toBe(true);
    if (check.success) {
      expect(check.data.status).toBe("REQUESTED");
      expect(check.data.requestedAt).not.toBeNull();
    }
  });

  it("7. Cannot create another indent when one is already REQUESTED", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: { id: testUserId, email: "headcook.indent@test.com", role: "HEAD_COOK", contractorId: testContractorId, kitchenId: testKitchenIdA },
    } as any);

    const res = await createIndentFromApprovedPlan(testKitchenIdA, mealApprovedId);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("already been marked as REQUESTED");
      expect(res.indentId).toBe(createdIndentId);
    }
  });

  it("8. cancelIndent marks indent status as CANCELLED", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: { id: testUserId, email: "headcook.indent@test.com", role: "HEAD_COOK", contractorId: testContractorId, kitchenId: testKitchenIdA },
    } as any);

    const res = await cancelIndent(testKitchenIdA, createdIndentId);
    expect(res.success).toBe(true);

    const check = await getIndent(testKitchenIdA, createdIndentId);
    expect(check.success).toBe(true);
    if (check.success) {
      expect(check.data.status).toBe("CANCELLED");
    }
  });

  it("9. Cannot mark a CANCELLED indent as requested", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: { id: testUserId, email: "headcook.indent@test.com", role: "HEAD_COOK", contractorId: testContractorId, kitchenId: testKitchenIdA },
    } as any);

    const res = await markIndentRequested(testKitchenIdA, createdIndentId);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("cancelled");
    }
  });

  it("10. listIndents returns formatted summaries with line count and total kg", async () => {
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: { id: testUserId, email: "headcook.indent@test.com", role: "HEAD_COOK", contractorId: testContractorId, kitchenId: testKitchenIdA },
    } as any);

    const res = await listIndents(testKitchenIdA);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.length).toBeGreaterThanOrEqual(1);
      const ind = res.data.find((i) => i.id === createdIndentId);
      expect(ind).toBeDefined();
      expect(ind?.lineCount).toBe(2);
      expect(ind?.totalTargetKg).toBe(80.5); // 48.0 + 32.5
    }
  });

  it("11. Tenant isolation: Cross-kitchen access is denied (403)", async () => {
    // Kitchen B user attempting to access Kitchen A indent
    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: false,
      error: "Access denied to kitchen facility",
    } as any);

    const createRes = await createIndentFromApprovedPlan(testKitchenIdA, mealApprovedId);
    expect(createRes.success).toBe(false);

    const getRes = await getIndent(testKitchenIdA, createdIndentId);
    expect(getRes.success).toBe(false);

    const listRes = await listIndents(testKitchenIdA);
    expect(listRes.success).toBe(false);

    const markRes = await markIndentRequested(testKitchenIdA, createdIndentId);
    expect(markRes.success).toBe(false);

    const cancelRes = await cancelIndent(testKitchenIdA, createdIndentId);
    expect(cancelRes.success).toBe(false);
  });
});
