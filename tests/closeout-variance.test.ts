import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  calculateServedKg,
  calculateCloseoutVariance,
  isServiceObservationEligible,
} from "../src/lib/domain/closeout-variance";
import {
  getCloseoutVarianceSummary,
  submitCloseout,
} from "../src/server/actions/closeout";
import { normalizeServiceDate } from "../src/lib/domain/date";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";

// Mock session module to control kitchen access
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireKitchenAccess: vi.fn(),
    getSessionUser: vi.fn(),
  };
});

import { requireKitchenAccess, getSessionUser } from "../src/lib/auth/session";

describe("Wave 1 / T1-A: Closeout Consumption Variance", () => {
  describe("Pure Domain Logic (Unit Tests)", () => {
    it("calculateServedKg calculates served kg and skips invalid or negative rows", () => {
      const observations = [
        { totalCookedKg: 30, unservedLeftoverKg: 5 }, // 25
        { totalCookedKg: 20, unservedLeftoverKg: 0 }, // 20
        { totalCookedKg: null, unservedLeftoverKg: 2 }, // skip
        { totalCookedKg: 10, unservedLeftoverKg: 15 }, // invalid (leftover > cooked) -> skip
        { totalCookedKg: -5, unservedLeftoverKg: 0 }, // invalid -> skip
      ];
      expect(calculateServedKg(observations)).toBe(45);
    });

    it("isServiceObservationEligible correctly flags eligible vs ineligible observations", () => {
      expect(
        isServiceObservationEligible({
          totalCookedKg: 20,
          unservedLeftoverKg: 2,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "ELIGIBLE",
        })
      ).toBe(true);

      // Stockout -> ineligible
      expect(
        isServiceObservationEligible({
          totalCookedKg: 20,
          unservedLeftoverKg: 0,
          isStockout: true,
          isAbnormal: false,
        })
      ).toBe(false);

      // Abnormal -> ineligible
      expect(
        isServiceObservationEligible({
          totalCookedKg: 20,
          unservedLeftoverKg: 2,
          isStockout: false,
          isAbnormal: true,
        })
      ).toBe(false);

      // Leftover > Cooked -> ineligible
      expect(
        isServiceObservationEligible({
          totalCookedKg: 10,
          unservedLeftoverKg: 12,
          isStockout: false,
          isAbnormal: false,
        })
      ).toBe(false);
    });

    it("calculateCloseoutVariance returns insufficient history when prior services count < 3", () => {
      const thisService = { servedKg: 50, actualDiners: 100 };
      const twoPriors = [
        { id: "s-1", date: "2026-11-01", actualDiners: 100, servedKg: 45 },
        { id: "s-2", date: "2026-11-02", actualDiners: 100, servedKg: 46 },
      ];

      const res = calculateCloseoutVariance(thisService, twoPriors);
      expect(res.hasEnoughHistory).toBe(false);
      expect(res.priorServicesCount).toBe(2);
      expect(res.message).toBe("Not enough eligible history to compare yet");
      expect(res.variancePct).toBeUndefined();
    });

    it("calculateCloseoutVariance computes accurate percentage and neutral label when history >= 3", () => {
      const thisService = { servedKg: 50, actualDiners: 100 }; // 0.500 kg/diner
      const priors = [
        { id: "s-1", date: "2026-11-01", actualDiners: 100, servedKg: 40 },
        { id: "s-2", date: "2026-11-02", actualDiners: 100, servedKg: 40 },
        { id: "s-3", date: "2026-11-03", actualDiners: 100, servedKg: 40 },
      ]; // Baseline = 120 / 300 = 0.400 kg/diner

      // Variance = (0.500 - 0.400) / 0.400 * 100 = +25.0%
      const res = calculateCloseoutVariance(thisService, priors);
      expect(res.hasEnoughHistory).toBe(true);
      expect(res.priorServicesCount).toBe(3);
      expect(res.thisServiceKgPerDiner).toBe(0.5);
      expect(res.baselineKgPerDiner).toBe(0.4);
      expect(res.variancePct).toBe(25);
      expect(res.varianceLabel).toBe("higher");
      expect(res.varianceText).toContain("+25.0% higher than recent eligible average");
    });

    it("calculateCloseoutVariance handles similar variance (< 2%) with neutral wording", () => {
      const thisService = { servedKg: 40.4, actualDiners: 100 }; // 0.404 kg/diner
      const priors = [
        { id: "s-1", date: "2026-11-01", actualDiners: 100, servedKg: 40 },
        { id: "s-2", date: "2026-11-02", actualDiners: 100, servedKg: 40 },
        { id: "s-3", date: "2026-11-03", actualDiners: 100, servedKg: 40 },
      ]; // Baseline = 0.400 kg/diner

      const res = calculateCloseoutVariance(thisService, priors);
      expect(res.hasEnoughHistory).toBe(true);
      expect(res.variancePct).toBe(1);
      expect(res.varianceLabel).toBe("similar");
      expect(res.varianceText).toContain("similar to recent eligible average");
    });

    it("calculateCloseoutVariance safely handles zero diners or invalid input without dividing by zero", () => {
      const res = calculateCloseoutVariance({ servedKg: 50, actualDiners: 0 }, []);
      expect(res.hasEnoughHistory).toBe(false);
      expect(res.variancePct).toBeUndefined();
    });
  });

  describe("Server Action & Integration Tests", () => {
    const testKitchenIdA = "test-variance-kitchen-a";
    const testKitchenIdB = "test-variance-kitchen-b";
    const testContractorId = "test-variance-contractor";
    const testUserId = "test-variance-user";

    let testDishIdA: string;
    let testDishIdB: string;

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
            name: "Chef Head Cook",
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
        name: "Chef Head Cook",
        role: "HEAD_COOK",
        contractorId: testContractorId,
        kitchenId: testKitchenIdA,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      });

      // Cleanup test data
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

      // Seed contractor and kitchens
      const code = await generateNextContractorCode();
      await prisma.contractor.create({
        data: {
          id: testContractorId,
          code,
          name: "Variance Test Org",
          status: "ACTIVE",
        },
      });

      await prisma.kitchen.create({
        data: {
          id: testKitchenIdA,
          name: "Variance Central Kitchen",
          contractorId: testContractorId,
        },
      });

      await prisma.kitchen.create({
        data: {
          id: testKitchenIdB,
          name: "Variance Secondary Kitchen",
          contractorId: testContractorId,
        },
      });

      await prisma.user.create({
        data: {
          id: testUserId,
          email: "headcook@cookcue.com",
          name: "Chef Head Cook",
          role: "HEAD_COOK",
          contractorId: testContractorId,
          kitchenId: testKitchenIdA,
          status: "ACTIVE",
        },
      });

      const dishA = await prisma.dish.create({
        data: {
          name: "Variance Rice",
          kitchenId: testKitchenIdA,
          unit: "kg",
        },
      });
      testDishIdA = dishA.id;

      const dishB = await prisma.dish.create({
        data: {
          name: "Variance Dal",
          kitchenId: testKitchenIdA,
          unit: "kg",
        },
      });
      testDishIdB = dishB.id;
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

    it("returns 'Not enough eligible history to compare yet' when fewer than 3 prior eligible services exist", async () => {
      // Create single meal and closeout
      const meal = await prisma.meal.create({
        data: {
          kitchenId: testKitchenIdA,
          date: normalizeServiceDate("2026-11-20"),
          mealType: "LUNCH",
        },
      });

      const plan = await prisma.cookingPlan.create({
        data: {
          mealId: meal.id,
          kitchenId: testKitchenIdA,
          expectedDiners: 100,
          status: "APPROVED",
          approvalStatus: "APPROVED",
        },
      });

      await prisma.planItem.create({
        data: {
          planId: plan.id,
          dishId: testDishIdA,
          approvedKg: 30,
          recommendedKg: 30,
        },
      });

      const submitRes = await submitCloseout({
        kitchenId: testKitchenIdA,
        mealId: meal.id,
        actualDiners: 100,
        items: [
          {
            dishId: testDishIdA,
            totalCookedKg: 30,
            unservedLeftoverKg: 2,
            isStockout: false,
            isAbnormal: false,
          },
        ],
      });

      expect(submitRes.success).toBe(true);
      if (!submitRes.success) return;

      expect(submitRes.variance).toBeDefined();
      expect(submitRes.variance?.hasEnoughHistory).toBe(false);
      expect(submitRes.variance?.priorServicesCount).toBe(0);
      expect(submitRes.variance?.message).toBe("Not enough eligible history to compare yet");

      // Verify direct action call
      const summaryRes = await getCloseoutVarianceSummary(testKitchenIdA, meal.id);
      expect(summaryRes.success).toBe(true);
      if (!summaryRes.success) return;
      expect(summaryRes.data.hasEnoughHistory).toBe(false);
      expect(summaryRes.data.message).toBe("Not enough eligible history to compare yet");
    });

    it("computes accurate variance when 3 prior eligible services exist for the same mealType", async () => {
      // Seed 3 prior eligible lunch services on Day 1, 2, 3
      // Day 1: 100 diners, 40kg served
      // Day 2: 100 diners, 40kg served
      // Day 3: 100 diners, 40kg served
      // Baseline = 120 / 300 = 0.400 kg/diner
      const dates = ["2026-11-15", "2026-11-16", "2026-11-17"];
      for (const d of dates) {
        const m = await prisma.meal.create({
          data: {
            kitchenId: testKitchenIdA,
            date: normalizeServiceDate(d),
            mealType: "LUNCH",
          },
        });
        await prisma.observation.create({
          data: {
            kitchenId: testKitchenIdA,
            mealId: m.id,
            dishId: testDishIdA,
            actualDiners: 100,
            totalCookedKg: 42,
            unservedLeftoverKg: 2, // 40kg served
            isStockout: false,
            isAbnormal: false,
            eligibilityStatus: "ELIGIBLE",
          },
        });
      }

      // Now create today's meal (Day 4: 2026-11-18)
      // Actual: 100 diners, 45kg served -> 0.450 kg/diner
      // Expected variance = (0.450 - 0.400) / 0.400 * 100 = +12.5% higher
      const todayMeal = await prisma.meal.create({
        data: {
          kitchenId: testKitchenIdA,
          date: normalizeServiceDate("2026-11-18"),
          mealType: "LUNCH",
        },
      });

      const todayPlan = await prisma.cookingPlan.create({
        data: {
          mealId: todayMeal.id,
          kitchenId: testKitchenIdA,
          expectedDiners: 100,
          status: "APPROVED",
          approvalStatus: "APPROVED",
        },
      });

      await prisma.planItem.create({
        data: {
          planId: todayPlan.id,
          dishId: testDishIdA,
          approvedKg: 45,
          recommendedKg: 45,
        },
      });

      const submitRes = await submitCloseout({
        kitchenId: testKitchenIdA,
        mealId: todayMeal.id,
        actualDiners: 100,
        items: [
          {
            dishId: testDishIdA,
            totalCookedKg: 47,
            unservedLeftoverKg: 2, // 45kg served
            isStockout: false,
            isAbnormal: false,
          },
        ],
      });

      expect(submitRes.success).toBe(true);
      if (!submitRes.success) return;

      const variance = submitRes.variance;
      expect(variance).toBeDefined();
      expect(variance?.hasEnoughHistory).toBe(true);
      expect(variance?.priorServicesCount).toBe(3);
      expect(variance?.thisServiceKgPerDiner).toBe(0.45);
      expect(variance?.baselineKgPerDiner).toBe(0.4);
      expect(variance?.variancePct).toBe(12.5);
      expect(variance?.varianceLabel).toBe("higher");
      expect(variance?.varianceText).toContain("+12.5% higher than recent eligible average");
    });

    it("excludes prior services with stockouts from eligible baseline calculation", async () => {
      // 2 clean services + 1 service with a stockout
      const cleanDates = ["2026-11-10", "2026-11-11"];
      for (const d of cleanDates) {
        const m = await prisma.meal.create({
          data: {
            kitchenId: testKitchenIdA,
            date: normalizeServiceDate(d),
            mealType: "LUNCH",
          },
        });
        await prisma.observation.create({
          data: {
            kitchenId: testKitchenIdA,
            mealId: m.id,
            dishId: testDishIdA,
            actualDiners: 100,
            totalCookedKg: 40,
            unservedLeftoverKg: 0,
            isStockout: false,
            isAbnormal: false,
            eligibilityStatus: "ELIGIBLE",
          },
        });
      }

      // Stockout service
      const stockoutMeal = await prisma.meal.create({
        data: {
          kitchenId: testKitchenIdA,
          date: normalizeServiceDate("2026-11-12"),
          mealType: "LUNCH",
        },
      });
      await prisma.observation.create({
        data: {
          kitchenId: testKitchenIdA,
          mealId: stockoutMeal.id,
          dishId: testDishIdA,
          actualDiners: 100,
          totalCookedKg: 30,
          unservedLeftoverKg: 0,
          isStockout: true, // Ran out!
          isAbnormal: false,
          eligibilityStatus: "EXCLUDED",
        },
      });

      // Today's meal
      const todayMeal = await prisma.meal.create({
        data: {
          kitchenId: testKitchenIdA,
          date: normalizeServiceDate("2026-11-13"),
          mealType: "LUNCH",
        },
      });

      const todayPlan = await prisma.cookingPlan.create({
        data: {
          mealId: todayMeal.id,
          kitchenId: testKitchenIdA,
          expectedDiners: 100,
          status: "APPROVED",
          approvalStatus: "APPROVED",
        },
      });

      await prisma.planItem.create({
        data: {
          planId: todayPlan.id,
          dishId: testDishIdA,
          approvedKg: 40,
          recommendedKg: 40,
        },
      });

      const submitRes = await submitCloseout({
        kitchenId: testKitchenIdA,
        mealId: todayMeal.id,
        actualDiners: 100,
        items: [
          {
            dishId: testDishIdA,
            totalCookedKg: 40,
            unservedLeftoverKg: 1,
            isStockout: false,
            isAbnormal: false,
          },
        ],
      });

      expect(submitRes.success).toBe(true);
      if (!submitRes.success) return;

      // Stockout meal was excluded, so only 2 eligible services were found
      expect(submitRes.variance?.hasEnoughHistory).toBe(false);
      expect(submitRes.variance?.priorServicesCount).toBe(2);
      expect(submitRes.variance?.message).toBe("Not enough eligible history to compare yet");
    });

    it("does not pool services from other kitchens (strict multi-tenant isolation)", async () => {
      // Seed 5 eligible services in Kitchen B
      for (let i = 1; i <= 5; i++) {
        const m = await prisma.meal.create({
          data: {
            kitchenId: testKitchenIdB,
            date: normalizeServiceDate(`2026-11-0${i}`),
            mealType: "LUNCH",
          },
        });
        await prisma.observation.create({
          data: {
            kitchenId: testKitchenIdB,
            mealId: m.id,
            dishId: testDishIdA,
            actualDiners: 100,
            totalCookedKg: 40,
            unservedLeftoverKg: 2,
            isStockout: false,
            isAbnormal: false,
            eligibilityStatus: "ELIGIBLE",
          },
        });
      }

      // Meal in Kitchen A (0 history in Kitchen A)
      const mealA = await prisma.meal.create({
        data: {
          kitchenId: testKitchenIdA,
          date: normalizeServiceDate("2026-11-10"),
          mealType: "LUNCH",
        },
      });
      await prisma.observation.create({
        data: {
          kitchenId: testKitchenIdA,
          mealId: mealA.id,
          dishId: testDishIdA,
          actualDiners: 100,
          totalCookedKg: 40,
          unservedLeftoverKg: 2,
          isStockout: false,
          isAbnormal: false,
          eligibilityStatus: "ELIGIBLE",
        },
      });

      const res = await getCloseoutVarianceSummary(testKitchenIdA, mealA.id);
      expect(res.success).toBe(true);
      if (!res.success) return;

      // Must NOT see Kitchen B's 5 services
      expect(res.data.priorServicesCount).toBe(0);
      expect(res.data.hasEnoughHistory).toBe(false);
    });

    it("denies unauthorized kitchen access with 403 Forbidden", async () => {
      const res = await getCloseoutVarianceSummary("unauthorized-kitchen", "meal-123");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Access denied");
        expect(res.statusCode).toBe(403);
      }
    });

    it("denies access when requested meal belongs to another kitchen", async () => {
      const mealB = await prisma.meal.create({
        data: {
          kitchenId: testKitchenIdB,
          date: normalizeServiceDate("2026-11-20"),
          mealType: "LUNCH",
        },
      });

      // User has access to testKitchenIdA, but attempts to query mealB
      const res = await getCloseoutVarianceSummary(testKitchenIdA, mealB.id);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.statusCode).toBe(403);
        expect(res.error).toContain("Forbidden");
      }
    });
  });
});
