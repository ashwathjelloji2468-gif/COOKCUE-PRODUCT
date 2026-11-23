import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  getContractorExceptions,
  getPlatformExceptions,
  detectOperationalExceptions,
} from "../src/server/actions/exceptions";
import { normalizeServiceDate, toServiceDateString } from "../src/lib/domain/date";

// Mock session module to control auth guards
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireContractorAccess: vi.fn(),
    requireFounder: vi.fn(),
  };
});

import { requireContractorAccess, requireFounder } from "../src/lib/auth/session";

describe("Phase A: Operational Exception Inbox", () => {
  const contractorIdA = "test-exc-contractor-a";
  const contractorIdB = "test-exc-contractor-b";
  const kitchenIdA1 = "test-exc-kitchen-a1";
  const kitchenIdA2 = "test-exc-kitchen-a2";
  const kitchenIdB1 = "test-exc-kitchen-b1";

  const dishIdA1 = "test-exc-dish-a1";
  const dishIdB1 = "test-exc-dish-b1";

  const evalDateStr = "2026-11-20";
  const evalDate = normalizeServiceDate(evalDateStr);
  const pastDateStr = "2026-11-18";
  const pastDate = normalizeServiceDate(pastDateStr);

  beforeEach(async () => {
    // Default mocks
    vi.mocked(requireContractorAccess).mockImplementation(async (targetIdOrCode: string) => {
      const trimmed = targetIdOrCode.trim();
      if (trimmed === contractorIdA || trimmed === "CTR-999001") {
        return {
          success: true,
          user: {
            id: "user-contractor-a",
            email: "contractor-a@test.com",
            name: "Contractor A Admin",
            role: "CONTRACTOR_ADMIN",
            contractorId: contractorIdA,
            kitchenId: null,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          },
        };
      }
      return {
        success: false,
        error: "Forbidden: cross-contractor access denied",
        statusCode: 403,
      };
    });

    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: "user-founder",
        email: "founder@cookcue.test",
        name: "Platform Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    // Cleanup existing fixtures
    await prisma.planOverrideAudit.deleteMany({
      where: { planItem: { plan: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } } } },
    });
    await prisma.planItem.deleteMany({
      where: { plan: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } } },
    });
    await prisma.cookingPlan.deleteMany({
      where: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } },
    });
    await prisma.observationAudit.deleteMany({
      where: { observation: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } } },
    });
    await prisma.observation.deleteMany({
      where: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } },
    });
    await prisma.meal.deleteMany({
      where: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } },
    });
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } },
    });
    await prisma.kitchen.deleteMany({
      where: { id: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } },
    });
    await prisma.contractor.deleteMany({
      where: { id: { in: [contractorIdA, contractorIdB] } },
    });

    // Seed test contractors and kitchens
    await prisma.contractor.create({
      data: {
        id: contractorIdA,
        code: "CTR-999001",
        name: "Contractor Alpha Corp",
        status: "ACTIVE",
      },
    });

    await prisma.contractor.create({
      data: {
        id: contractorIdB,
        code: "CTR-999002",
        name: "Contractor Beta Corp",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: kitchenIdA1,
        contractorId: contractorIdA,
        name: "Alpha Kitchen 1",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: kitchenIdA2,
        contractorId: contractorIdA,
        name: "Alpha Kitchen 2",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: kitchenIdB1,
        contractorId: contractorIdB,
        name: "Beta Kitchen 1",
        status: "ACTIVE",
      },
    });

    await prisma.dish.create({
      data: {
        id: dishIdA1,
        kitchenId: kitchenIdA1,
        name: "Paneer Butter Masala",
      },
    });

    await prisma.dish.create({
      data: {
        id: dishIdB1,
        kitchenId: kitchenIdB1,
        name: "Chicken Biryani",
      },
    });
  });

  afterAll(async () => {
    await prisma.planOverrideAudit.deleteMany({
      where: { planItem: { plan: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } } } },
    });
    await prisma.planItem.deleteMany({
      where: { plan: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } } },
    });
    await prisma.cookingPlan.deleteMany({
      where: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } },
    });
    await prisma.observationAudit.deleteMany({
      where: { observation: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } } },
    });
    await prisma.observation.deleteMany({
      where: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } },
    });
    await prisma.meal.deleteMany({
      where: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } },
    });
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } },
    });
    await prisma.kitchen.deleteMany({
      where: { id: { in: [kitchenIdA1, kitchenIdA2, kitchenIdB1] } },
    });
    await prisma.contractor.deleteMany({
      where: { id: { in: [contractorIdA, contractorIdB] } },
    });
  });

  it("1. Multi-tenant isolation: Contractor cannot access other contractor's exception inbox", async () => {
    // Contractor A tries to query Contractor B
    const res = await getContractorExceptions(contractorIdB);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.statusCode).toBe(403);
      expect(res.error).toContain("Forbidden");
    }
  });

  it("2. Returns empty exceptions list (or low history only) with all clear state when kitchens are healthy", async () => {
    // Seed 3 eligible observations for Kitchen A1 so it doesn't trigger LOW_ELIGIBLE_HISTORY
    for (let i = 1; i <= 3; i++) {
      const pastD = normalizeServiceDate(`2026-11-1${i}`);
      const m = await prisma.meal.create({
        data: {
          kitchenId: kitchenIdA1,
          mealType: "LUNCH",
          date: pastD,
          expectedDiners: 100,
        },
      });

      await prisma.cookingPlan.create({
        data: {
          kitchenId: kitchenIdA1,
          mealId: m.id,
          expectedDiners: 100,
          status: "APPROVED",
          approvalStatus: "APPROVED",
        },
      });

      await prisma.observation.create({
        data: {
          kitchenId: kitchenIdA1,
          mealId: m.id,
          dishId: dishIdA1,
          totalCookedKg: 20.0,
          unservedLeftoverKg: 1.0,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "ELIGIBLE",
        },
      });
    }

    // Only test kitchen A1 in isolation
    const exc = await detectOperationalExceptions(
      [{ id: kitchenIdA1, name: "Alpha Kitchen 1" }],
      evalDateStr
    );

    expect(exc).toHaveLength(0);
  });

  it("3. Detects PLAN_NOT_APPROVED when a meal for today is in DRAFT", async () => {
    const meal = await prisma.meal.create({
      data: {
        kitchenId: kitchenIdA1,
        mealType: "LUNCH",
        date: evalDate,
        expectedDiners: 150,
      },
    });

    await prisma.cookingPlan.create({
      data: {
        kitchenId: kitchenIdA1,
        mealId: meal.id,
        expectedDiners: 150,
        status: "DRAFT",
        approvalStatus: "DRAFT",
      },
    });

    const res = await getContractorExceptions(contractorIdA, evalDateStr);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const planNotApproved = res.data.find((e) => e.type === "PLAN_NOT_APPROVED");
    expect(planNotApproved).toBeDefined();
    expect(planNotApproved?.kitchenId).toBe(kitchenIdA1);
    expect(planNotApproved?.severity).toBe("HIGH");
    expect(planNotApproved?.href).toBe(`/kitchen/${kitchenIdA1}/morning`);
    expect(planNotApproved?.summary).toContain("plan for today is in DRAFT");
  });

  it("4. Detects CLOSEOUT_MISSING when a plan was APPROVED but no actuals submitted", async () => {
    const pastMeal = await prisma.meal.create({
      data: {
        kitchenId: kitchenIdA1,
        mealType: "DINNER",
        date: pastDate,
        expectedDiners: 200,
      },
    });

    await prisma.cookingPlan.create({
      data: {
        kitchenId: kitchenIdA1,
        mealId: pastMeal.id,
        expectedDiners: 200,
        status: "APPROVED",
        approvalStatus: "APPROVED",
      },
    });

    const res = await getContractorExceptions(contractorIdA, evalDateStr);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const closeoutMissing = res.data.find(
      (e) => e.type === "CLOSEOUT_MISSING" && e.mealType === "DINNER"
    );
    expect(closeoutMissing).toBeDefined();
    expect(closeoutMissing?.kitchenId).toBe(kitchenIdA1);
    expect(closeoutMissing?.severity).toBe("HIGH");
    expect(closeoutMissing?.href).toBe(`/kitchen/${kitchenIdA1}/closeout`);
    expect(closeoutMissing?.summary).toContain("closeout missing for 2026-11-18");
  });

  it("5. Detects STOCKOUT incident within 7-day window", async () => {
    const stockoutMeal = await prisma.meal.create({
      data: {
        kitchenId: kitchenIdA1,
        mealType: "LUNCH",
        date: pastDate,
        expectedDiners: 180,
      },
    });

    await prisma.cookingPlan.create({
      data: {
        kitchenId: kitchenIdA1,
        mealId: stockoutMeal.id,
        expectedDiners: 180,
        status: "APPROVED",
        approvalStatus: "APPROVED",
      },
    });

    await prisma.observation.create({
      data: {
        kitchenId: kitchenIdA1,
        mealId: stockoutMeal.id,
        dishId: dishIdA1,
        totalCookedKg: 35.0,
        unservedLeftoverKg: 0.0,
        actualDiners: 220,
        isStockout: true,
      },
    });

    const res = await getContractorExceptions(contractorIdA, evalDateStr);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const stockoutExc = res.data.find((e) => e.type === "STOCKOUT");
    expect(stockoutExc).toBeDefined();
    expect(stockoutExc?.kitchenId).toBe(kitchenIdA1);
    expect(stockoutExc?.severity).toBe("HIGH");
    expect(stockoutExc?.summary).toContain("Stockout recorded for Paneer Butter Masala");
    expect(stockoutExc?.href).toBe(`/kitchen/${kitchenIdA1}/closeout`);
  });

  it("6. Sorts exceptions by severity first, then by date descending", async () => {
    const res = await getContractorExceptions(contractorIdA, evalDateStr);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const severityRank: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    // Ensure array is strictly sorted by severity rank descending
    for (let i = 0; i < res.data.length - 1; i++) {
      const current = res.data[i];
      const next = res.data[i + 1];
      expect(severityRank[current.severity]).toBeGreaterThanOrEqual(
        severityRank[next.severity]
      );
    }
  });

  it("7. getPlatformExceptions enables Platform Founder to inspect all kitchens across contractors", async () => {
    const res = await getPlatformExceptions(evalDateStr);
    expect(res.success).toBe(true);
    if (!res.success) return;

    // Must include kitchens from both contractor A and contractor B
    const kitchenIds = new Set(res.data.map((e) => e.kitchenId));
    expect(kitchenIds.has(kitchenIdA1) || kitchenIds.has(kitchenIdA2)).toBe(true);
    expect(kitchenIds.has(kitchenIdB1)).toBe(true);
  });
});
