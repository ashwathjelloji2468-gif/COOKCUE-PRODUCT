import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { getContractorWeeklyScorecard } from "../src/server/actions/scorecard";
import {
  computeKitchenWeeklyMetrics,
  sortKitchenScorecards,
  isObservationEligible,
  KitchenWeeklyScorecard,
} from "../src/lib/domain/scorecard";
import { normalizeServiceDate, toServiceDateString } from "../src/lib/domain/date";

// Mock session module to test contractor access
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireContractorAccess: vi.fn(),
    requireFounder: vi.fn(),
  };
});

import { requireContractorAccess, requireFounder } from "../src/lib/auth/session";

describe("Wave 1 / T1-C: Contractor Weekly Scorecard", () => {
  const contractorIdA = "test-scorecard-contractor-a";
  const contractorIdB = "test-scorecard-contractor-b";
  const kitchenIdA1 = "test-scorecard-kitchen-a1";
  const kitchenIdA2 = "test-scorecard-kitchen-a2";
  const kitchenIdB1 = "test-scorecard-kitchen-b1";

  const dishIdA1 = "test-scorecard-dish-a1";
  const dishIdB1 = "test-scorecard-dish-b1";

  const evalDateStr = "2026-11-20";
  const evalDate = normalizeServiceDate(evalDateStr);
  const midDateStr = "2026-11-18";
  const midDate = normalizeServiceDate(midDateStr);
  const earlyDateStr = "2026-11-15";
  const earlyDate = normalizeServiceDate(earlyDateStr);

  beforeEach(async () => {
    vi.mocked(requireContractorAccess).mockImplementation(async (targetIdOrCode: string) => {
      const trimmed = targetIdOrCode.trim();
      if (trimmed === contractorIdA || trimmed === "CTR-SC0001") {
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
        id: "founder-user-id",
        email: "cookcue149@gmail.com",
        name: "Platform Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    // Cleanup
    const allKitchenIds = [kitchenIdA1, kitchenIdA2, kitchenIdB1];
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
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: { in: [contractorIdA, contractorIdB] } },
    }).catch(() => {});

    // Seed test fixtures
    await prisma.contractor.create({
      data: {
        id: contractorIdA,
        code: "CTR-SC0001",
        name: "Compass Group Facilities",
        status: "ACTIVE",
      },
    });

    await prisma.contractor.create({
      data: {
        id: contractorIdB,
        code: "CTR-SC0002",
        name: "Aramark Operations",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: kitchenIdA1,
        contractorId: contractorIdA,
        name: "Main Dining Hall",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: kitchenIdA2,
        contractorId: contractorIdA,
        name: "North Campus Commons",
        status: "ACTIVE",
      },
    });

    await prisma.kitchen.create({
      data: {
        id: kitchenIdB1,
        contractorId: contractorIdB,
        name: "Hospitality Lounge B",
        status: "ACTIVE",
      },
    });

    await prisma.dish.create({
      data: {
        id: dishIdA1,
        kitchenId: kitchenIdA1,
        name: "Steamed Rice",
      },
    });

    await prisma.dish.create({
      data: {
        id: dishIdB1,
        kitchenId: kitchenIdB1,
        name: "Lentil Soup",
      },
    });
  });

  afterAll(async () => {
    const allKitchenIds = [kitchenIdA1, kitchenIdA2, kitchenIdB1];
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
    await prisma.dish.deleteMany({
      where: { kitchenId: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.kitchen.deleteMany({
      where: { id: { in: allKitchenIds } },
    }).catch(() => {});
    await prisma.contractor.deleteMany({
      where: { id: { in: [contractorIdA, contractorIdB] } },
    }).catch(() => {});
  });

  describe("Pure Domain Calculations", () => {
    it("safely handles division by zero when no meals have approved plans", () => {
      const metrics = computeKitchenWeeklyMetrics({
        kitchen: { id: "k-1", name: "Empty Kitchen", status: "ACTIVE" },
        meals: [],
      });

      expect(metrics.closeoutCompliancePct).toBeNull();
      expect(metrics.approvedPlansCount).toBe(0);
      expect(metrics.approvedWithCloseoutCount).toBe(0);
      expect(metrics.plansApprovedOnTimeCount).toBe(0);
      expect(metrics.plansDraftOrMissingCount).toBe(0);
      expect(metrics.stockoutDays).toBe(0);
      expect(metrics.eligibleObservationCount).toBe(0);
    });

    it("computes accurate closeout compliance and plans draft/missing counts", () => {
      const mockMeals = [
        {
          id: "m-1",
          kitchenId: "k-1",
          date: new Date("2026-11-18T00:00:00.000Z"),
          cookingPlan: { id: "p-1", status: "APPROVED" },
          observations: [
            {
              id: "o-1",
              isStockout: false,
              isAbnormal: false,
              isExcluded: false,
              totalCookedKg: 20,
              unservedLeftoverKg: 2,
              actualDiners: 100,
            },
          ],
        },
        {
          id: "m-2",
          kitchenId: "k-1",
          date: new Date("2026-11-19T00:00:00.000Z"),
          cookingPlan: { id: "p-2", status: "APPROVED" },
          observations: [], // Approved, but NO closeout
        },
        {
          id: "m-3",
          kitchenId: "k-1",
          date: new Date("2026-11-20T00:00:00.000Z"),
          cookingPlan: { id: "p-3", status: "DRAFT" }, // Draft, unapproved
          observations: [],
        },
      ];

      const metrics = computeKitchenWeeklyMetrics({
        kitchen: { id: "k-1", name: "Main Kitchen", status: "ACTIVE" },
        meals: mockMeals,
      });

      // 2 approved plans, 1 has closeout -> 1 / 2 = 50.0%
      expect(metrics.approvedPlansCount).toBe(2);
      expect(metrics.approvedWithCloseoutCount).toBe(1);
      expect(metrics.closeoutCompliancePct).toBe(50);
      expect(metrics.plansApprovedOnTimeCount).toBe(2);
      expect(metrics.plansDraftOrMissingCount).toBe(1);
      expect(metrics.stockoutDays).toBe(0);
      expect(metrics.eligibleObservationCount).toBe(1);
    });

    it("counts distinct dates for stockoutDays (multiple stockouts on same day count once)", () => {
      const sameDay = new Date("2026-11-18T00:00:00.000Z");
      const mockMeals = [
        {
          id: "m-1",
          kitchenId: "k-1",
          date: sameDay,
          cookingPlan: { id: "p-1", status: "APPROVED" },
          observations: [
            {
              id: "o-1",
              isStockout: true, // Stockout 1 on 2026-11-18
              isAbnormal: false,
              isExcluded: false,
              totalCookedKg: 20,
              unservedLeftoverKg: 0,
              actualDiners: 100,
            },
            {
              id: "o-2",
              isStockout: true, // Stockout 2 on 2026-11-18 (same date)
              isAbnormal: false,
              isExcluded: false,
              totalCookedKg: 15,
              unservedLeftoverKg: 0,
              actualDiners: 100,
            },
          ],
        },
        {
          id: "m-2",
          kitchenId: "k-1",
          date: new Date("2026-11-19T00:00:00.000Z"),
          cookingPlan: { id: "p-2", status: "APPROVED" },
          observations: [
            {
              id: "o-3",
              isStockout: true, // Stockout on 2026-11-19 (different date)
              isAbnormal: false,
              isExcluded: false,
              totalCookedKg: 10,
              unservedLeftoverKg: 0,
              actualDiners: 50,
            },
          ],
        },
      ];

      const metrics = computeKitchenWeeklyMetrics({
        kitchen: { id: "k-1", name: "High Demand Station", status: "ACTIVE" },
        meals: mockMeals,
      });

      // 3 observations with isStockout: true, but only 2 distinct dates
      expect(metrics.stockoutDays).toBe(2);
    });

    it("sorts kitchen scorecards: worst closeout compliance first, then most stockouts", () => {
      const mockKitchens: KitchenWeeklyScorecard[] = [
        {
          kitchenId: "k-best",
          name: "Best Compliance Kitchen",
          status: "ACTIVE",
          closeoutCompliancePct: 100,
          approvedPlansCount: 5,
          approvedWithCloseoutCount: 5,
          plansApprovedOnTimeCount: 5,
          plansDraftOrMissingCount: 0,
          stockoutDays: 0,
          eligibleObservationCount: 5,
          openExceptionsCount: 0,
        },
        {
          kitchenId: "k-worst",
          name: "Zero Closeout Kitchen",
          status: "ACTIVE",
          closeoutCompliancePct: 0,
          approvedPlansCount: 4,
          approvedWithCloseoutCount: 0,
          plansApprovedOnTimeCount: 4,
          plansDraftOrMissingCount: 0,
          stockoutDays: 1,
          eligibleObservationCount: 0,
          openExceptionsCount: 1,
        },
        {
          kitchenId: "k-mid",
          name: "Mid Compliance Kitchen",
          status: "ACTIVE",
          closeoutCompliancePct: 50,
          approvedPlansCount: 4,
          approvedWithCloseoutCount: 2,
          plansApprovedOnTimeCount: 4,
          plansDraftOrMissingCount: 0,
          stockoutDays: 3,
          eligibleObservationCount: 2,
          openExceptionsCount: 0,
        },
        {
          kitchenId: "k-tied-mid-more-stockouts",
          name: "Mid Compliance More Stockouts",
          status: "ACTIVE",
          closeoutCompliancePct: 50,
          approvedPlansCount: 4,
          approvedWithCloseoutCount: 2,
          plansApprovedOnTimeCount: 4,
          plansDraftOrMissingCount: 0,
          stockoutDays: 5,
          eligibleObservationCount: 2,
          openExceptionsCount: 0,
        },
      ];

      const sorted = sortKitchenScorecards(mockKitchens);

      // Order should be:
      // 1. k-worst (0% compliance)
      // 2. k-tied-mid-more-stockouts (50% compliance, 5 stockout days)
      // 3. k-mid (50% compliance, 3 stockout days)
      // 4. k-best (100% compliance, 0 stockout days)
      expect(sorted[0].kitchenId).toBe("k-worst");
      expect(sorted[1].kitchenId).toBe("k-tied-mid-more-stockouts");
      expect(sorted[2].kitchenId).toBe("k-mid");
      expect(sorted[3].kitchenId).toBe("k-best");
    });
  });

  describe("Server Action Integration & Multi-Tenant Isolation", () => {
    it("enforces tenant isolation and denies cross-contractor access", async () => {
      // User is authorized for contractor A, trying to view contractor B
      const res = await getContractorWeeklyScorecard(contractorIdB);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.statusCode).toBe(403);
        expect(res.error).toMatch(/Forbidden|denied/i);
      }
    });

    it("returns only kitchens belonging to target contractor, never leaking other tenants", async () => {
      const res = await getContractorWeeklyScorecard(contractorIdA, evalDateStr);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.contractor.id).toBe(contractorIdA);
        const kitchenIds = res.data.kitchens.map((k) => k.kitchenId);
        expect(kitchenIds).toContain(kitchenIdA1);
        expect(kitchenIds).toContain(kitchenIdA2);
        expect(kitchenIds).not.toContain(kitchenIdB1); // Tenant B kitchen must NOT be present
      }
    });

    it("returns correct week window (7 days ending on specified date)", async () => {
      const res = await getContractorWeeklyScorecard(contractorIdA, "2026-11-20");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.weekEnd).toBe("2026-11-20");
        expect(res.data.weekStart).toBe("2026-11-14"); // 2026-11-20 minus 6 days = 2026-11-14
      }
    });

    it("accurately computes metrics from real database records in the 7-day window", async () => {
      // 1. Create an approved meal with closeout observation on midDate (2026-11-18)
      const meal1 = await prisma.meal.create({
        data: {
          kitchenId: kitchenIdA1,
          date: midDate,
          mealType: "LUNCH",
          expectedDiners: 150,
          cookingPlan: {
            create: {
              kitchenId: kitchenIdA1,
              expectedDiners: 150,
              status: "APPROVED",
              approvalStatus: "APPROVED",
            },
          },
          observations: {
            create: {
              kitchenId: kitchenIdA1,
              dishId: dishIdA1,
              totalCookedKg: 30,
              unservedLeftoverKg: 2,
              actualDiners: 145,
              isStockout: false,
              eligibilityStatus: "ELIGIBLE",
            },
          },
        },
      });

      // 2. Create another approved meal on evalDate (2026-11-20) with a stockout observation
      const meal2 = await prisma.meal.create({
        data: {
          kitchenId: kitchenIdA1,
          date: evalDate,
          mealType: "DINNER",
          expectedDiners: 120,
          cookingPlan: {
            create: {
              kitchenId: kitchenIdA1,
              expectedDiners: 120,
              status: "APPROVED",
              approvalStatus: "APPROVED",
            },
          },
          observations: {
            create: {
              kitchenId: kitchenIdA1,
              dishId: dishIdA1,
              totalCookedKg: 25,
              unservedLeftoverKg: 0,
              actualDiners: 130,
              isStockout: true, // Stockout incident
              eligibilityStatus: "EXCLUDED",
            },
          },
        },
      });

      // 3. Create a meal with DRAFT plan on earlyDate (2026-11-15) and NO closeout
      const meal3 = await prisma.meal.create({
        data: {
          kitchenId: kitchenIdA1,
          date: earlyDate,
          mealType: "BREAKFAST",
          expectedDiners: 80,
          cookingPlan: {
            create: {
              kitchenId: kitchenIdA1,
              expectedDiners: 80,
              status: "DRAFT",
              approvalStatus: "DRAFT",
            },
          },
        },
      });

      const res = await getContractorWeeklyScorecard(contractorIdA, evalDateStr);
      expect(res.success).toBe(true);
      if (res.success) {
        const kA1 = res.data.kitchens.find((k) => k.kitchenId === kitchenIdA1);
        expect(kA1).toBeDefined();
        if (kA1) {
          // 2 approved plans (meal1, meal2) both have closeout observations -> 100%
          expect(kA1.approvedPlansCount).toBe(2);
          expect(kA1.approvedWithCloseoutCount).toBe(2);
          expect(kA1.closeoutCompliancePct).toBe(100);
          expect(kA1.plansApprovedOnTimeCount).toBe(2);
          expect(kA1.plansDraftOrMissingCount).toBe(1); // meal3 was DRAFT
          expect(kA1.stockoutDays).toBe(1); // 1 day with stockout (evalDate)
          expect(kA1.eligibleObservationCount).toBe(1); // meal1 observation was eligible
        }

        // kitchenA2 had 0 meals: division by zero safe
        const kA2 = res.data.kitchens.find((k) => k.kitchenId === kitchenIdA2);
        expect(kA2).toBeDefined();
        if (kA2) {
          expect(kA2.closeoutCompliancePct).toBeNull();
          expect(kA2.approvedPlansCount).toBe(0);
          expect(kA2.stockoutDays).toBe(0);
        }
      }
    });
  });
});
