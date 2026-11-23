import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { getKitchenOnboardingProgress } from "../src/server/actions/kitchen-onboarding";
import { deriveKitchenOnboardingProgress } from "../src/lib/domain/kitchen-onboarding";
import { normalizeServiceDate } from "../src/lib/domain/date";

// Mock session module to test kitchen access
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
  };
});

import { requireKitchenAccess } from "../src/lib/auth/session";

describe("Wave 1 / T1-D: New Kitchen Onboarding Wizard", () => {
  const contractorId = "test-onboard-contractor";
  const kitchenIdA = "test-onboard-kitchen-a";
  const kitchenIdB = "test-onboard-kitchen-b";
  const userId = "test-onboard-head-cook";

  const dishIdA1 = "test-onboard-dish-a1";
  const templateIdA1 = "test-onboard-template-a1";

  beforeEach(async () => {
    vi.mocked(requireKitchenAccess).mockImplementation(async (targetKitchenId: string) => {
      if (targetKitchenId === kitchenIdA) {
        return {
          success: true,
          user: {
            id: userId,
            email: "headcook@test.com",
            name: "Head Cook",
            role: "HEAD_COOK",
            contractorId,
            kitchenId: kitchenIdA,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          },
        };
      }
      return {
        success: false,
        error: "Forbidden: cross-kitchen access denied",
        statusCode: 403,
      };
    });

    // Cleanup
    const allKitchenIds = [kitchenIdA, kitchenIdB];
    await prisma.observationAudit.deleteMany({
      where: { observation: { kitchenId: { in: allKitchenIds } } },
    }).catch(() => {});
    await prisma.observation.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.planItem.deleteMany({
      where: { plan: { kitchenId: { in: allKitchenIds } } },
    }).catch(() => {});
    await prisma.cookingPlan.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.meal.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.kitchenServiceTemplate.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: contractorId },
    }).catch(() => {});

    // Seed test fixtures
    await prisma.contractor.create({
      data: {
        id: contractorId,
        code: "CTR-ONB001",
        name: "Campus Dining Group",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: kitchenIdA,
        contractorId,
        name: "Brand New Station A",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: kitchenIdB,
        contractorId,
        name: "Unauthorized Station B",
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    const allKitchenIds = [kitchenIdA, kitchenIdB];
    await prisma.observationAudit.deleteMany({
      where: { observation: { kitchenId: { in: allKitchenIds } } },
    }).catch(() => {});
    await prisma.observation.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.planItem.deleteMany({
      where: { plan: { kitchenId: { in: allKitchenIds } } },
    }).catch(() => {});
    await prisma.cookingPlan.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.meal.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.kitchenServiceTemplate.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: contractorId },
    }).catch(() => {});
  });

  describe("Pure Domain Step Derivation", () => {
    it("reports all steps incomplete for a brand new kitchen", () => {
      const progress = deriveKitchenOnboardingProgress({
        kitchenId: "k-new",
        kitchenName: "Pristine Kitchen",
        dishesCount: 0,
        templatesCount: 0,
        approvedPlansCount: 0,
        closeoutObservationsCount: 0,
        eligibleObservationsCount: 0,
      });

      expect(progress.completedCount).toBe(0);
      expect(progress.total).toBe(5);
      expect(progress.isComplete).toBe(false);
      expect(progress.steps.every((s) => !s.done)).toBe(true);
      expect(progress.primaryCta).toEqual({
        label: "Next: Add menu dishes",
        href: "/kitchen/k-new/dishes",
        stepId: "ADD_DISHES",
      });
      expect(progress.neededEligibleCount).toBe(3);
      expect(progress.steps[4].detail).toContain("Need 3 more eligible services");
    });

    it("correctly marks steps as done as real milestones accumulate", () => {
      const progress = deriveKitchenOnboardingProgress({
        kitchenId: "k-progressing",
        kitchenName: "Progressing Kitchen",
        dishesCount: 4,
        templatesCount: 1,
        approvedPlansCount: 2,
        closeoutObservationsCount: 2,
        eligibleObservationsCount: 1,
      });

      expect(progress.completedCount).toBe(4);
      expect(progress.total).toBe(5);
      expect(progress.isComplete).toBe(false);

      expect(progress.steps[0].done).toBe(true); // ADD_DISHES
      expect(progress.steps[1].done).toBe(true); // SAVE_TEMPLATE
      expect(progress.steps[2].done).toBe(true); // APPROVE_PLAN
      expect(progress.steps[3].done).toBe(true); // SUBMIT_CLOSEOUT
      expect(progress.steps[4].done).toBe(false); // BUILD_BASELINE (needs 3, has 1)

      expect(progress.neededEligibleCount).toBe(2);
      expect(progress.steps[4].detail).toContain("Need 2 more eligible services");
      expect(progress.primaryCta?.stepId).toBe("BUILD_BASELINE");
    });

    it("marks wizard complete when eligible observations reach 3", () => {
      const progress = deriveKitchenOnboardingProgress({
        kitchenId: "k-mature",
        kitchenName: "Mature Kitchen",
        dishesCount: 10,
        templatesCount: 3,
        approvedPlansCount: 15,
        closeoutObservationsCount: 15,
        eligibleObservationsCount: 3,
      });

      expect(progress.completedCount).toBe(5);
      expect(progress.total).toBe(5);
      expect(progress.isComplete).toBe(true);
      expect(progress.steps.every((s) => s.done)).toBe(true);
      expect(progress.neededEligibleCount).toBe(0);
      expect(progress.steps[4].detail).toContain("baseline active");
      expect(progress.primaryCta).toBeNull();
    });
  });

  describe("Server Action & Security Guards", () => {
    it("enforces requireKitchenAccess and rejects unauthorized kitchen with 403", async () => {
      const res = await getKitchenOnboardingProgress(kitchenIdB);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.statusCode).toBe(403);
        expect(res.error).toMatch(/Forbidden|denied/i);
      }
    });

    it("returns all incomplete steps for an empty new kitchen", async () => {
      const res = await getKitchenOnboardingProgress(kitchenIdA);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.kitchenId).toBe(kitchenIdA);
        expect(res.data.completedCount).toBe(0);
        expect(res.data.total).toBe(5);
        expect(res.data.isComplete).toBe(false);
        expect(res.data.primaryCta?.stepId).toBe("ADD_DISHES");
      }
    });

    it("flips steps done correctly after dish, template, plan, and closeout records exist", async () => {
      // 1. Add Dish -> Step 1 flips done
      await prisma.dish.create({
        data: {
          id: dishIdA1,
          kitchenId: kitchenIdA,
          name: "Organic Quinoa Pilaf",
          unit: "kg",
        },
      });

      // 2. Add Template -> Step 2 flips done
      await prisma.kitchenServiceTemplate.create({
        data: {
          id: templateIdA1,
          kitchenId: kitchenIdA,
          name: "Standard Weekday Lunch",
          mealType: "LUNCH",
          dishIds: JSON.stringify([dishIdA1]),
        },
      });

      // 3. Add Meal + Approved CookingPlan -> Step 3 flips done
      const serviceDate = normalizeServiceDate("2026-11-20");
      const meal = await prisma.meal.create({
        data: {
          kitchenId: kitchenIdA,
          date: serviceDate,
          mealType: "LUNCH",
          expectedDiners: 100,
          cookingPlan: {
            create: {
              kitchenId: kitchenIdA,
              expectedDiners: 100,
              status: "APPROVED",
              approvalStatus: "APPROVED",
            },
          },
        },
      });

      // 4. Add Observation -> Step 4 flips done
      await prisma.observation.create({
        data: {
          kitchenId: kitchenIdA,
          mealId: meal.id,
          dishId: dishIdA1,
          totalCookedKg: 20,
          unservedLeftoverKg: 1.5,
          actualDiners: 95,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "ELIGIBLE",
        },
      });

      const res = await getKitchenOnboardingProgress(kitchenIdA);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.completedCount).toBe(4);
        expect(res.data.steps[0].done).toBe(true); // Dishes
        expect(res.data.steps[1].done).toBe(true); // Template
        expect(res.data.steps[2].done).toBe(true); // Approved Plan
        expect(res.data.steps[3].done).toBe(true); // Closeout Observation
        expect(res.data.steps[4].done).toBe(false); // Baseline (1 of 3 eligible)
        expect(res.data.neededEligibleCount).toBe(2);
        expect(res.data.primaryCta?.stepId).toBe("BUILD_BASELINE");
      }
    });
  });
});
