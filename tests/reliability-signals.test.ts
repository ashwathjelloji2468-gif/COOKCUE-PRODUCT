import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import {
  formatRelativeTime,
  formatExactDateTime,
  isCloseoutStale,
  isBaselineReady,
} from "../src/lib/kitchen/reliability";
import {
  getKitchenReliabilitySignal,
  getContractorKitchenReliability,
  getFounderKitchenReliability,
} from "../src/server/actions/reliability";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import { normalizeServiceDate } from "../src/lib/domain/date";

// Mock session authentication
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
    requireContractorAccess: vi.fn(),
    requireKitchenAccess: vi.fn(),
  };
});

import {
  requireFounder,
  requireContractorAccess,
  requireKitchenAccess,
} from "../src/lib/auth/session";

describe("WAVE 2 / T2-E — Reliability Signals", () => {
  const testContractorId = "test-rel-contractor";
  const testKitchenFreshId = "test-rel-kitchen-fresh";
  const testKitchenStaleId = "test-rel-kitchen-stale";
  const testKitchenEmptyId = "test-rel-kitchen-empty";
  const testDishId = "test-rel-dish-1";

  beforeAll(async () => {
    // Clean up any existing test records
    const kIds = [testKitchenFreshId, testKitchenStaleId, testKitchenEmptyId];
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: kIds } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

    // Create Contractor & Kitchens
    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorId,
        code: ctrCode,
        name: "Reliability Test Catering Org",
        status: "ACTIVE",
        kitchens: {
          create: [
            {
              id: testKitchenFreshId,
              name: "Fresh Central Kitchen",
              status: "ACTIVE",
            },
            {
              id: testKitchenStaleId,
              name: "Stale Production Kitchen",
              status: "ACTIVE",
            },
            {
              id: testKitchenEmptyId,
              name: "New Unused Kitchen",
              status: "ACTIVE",
            },
          ],
        },
      },
    });

    // Create dishes
    await prisma.dish.create({
      data: {
        id: testDishId,
        kitchenId: testKitchenFreshId,
        name: "Steamed Rice",
        unit: "kg",
      },
    });

    const now = Date.now();
    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    // 1. Fresh Kitchen: 3 eligible observations across 3 meals (baseline ready) + recently approved plan + recent closeout
    const mealFresh = await prisma.meal.create({
      data: {
        kitchenId: testKitchenFreshId,
        date: normalizeServiceDate(new Date()),
        mealType: "LUNCH",
        expectedDiners: 150,
      },
    });

    await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenFreshId,
        mealId: mealFresh.id,
        expectedDiners: 150,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApprovedAt: oneHourAgo,
      },
    });

    // 3 eligible observations to qualify for baseline (each with its own meal)
    for (let i = 0; i < 3; i++) {
      const meal = i === 0 ? mealFresh : await prisma.meal.create({
        data: {
          kitchenId: testKitchenFreshId,
          date: normalizeServiceDate(new Date(now - (i + 1) * 24 * 60 * 60 * 1000)),
          mealType: "LUNCH",
          expectedDiners: 150,
        },
      });

      await prisma.observation.create({
        data: {
          kitchenId: testKitchenFreshId,
          mealId: meal.id,
          dishId: testDishId,
          totalCookedKg: 30,
          unservedLeftoverKg: 2,
          actualDiners: 140,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "ELIGIBLE",
          createdAt: oneHourAgo,
        },
      });
    }

    // 2. Stale Kitchen: Approved plan 3 days ago, but NO closeout ever
    const mealStale = await prisma.meal.create({
      data: {
        kitchenId: testKitchenStaleId,
        date: normalizeServiceDate(threeDaysAgo),
        mealType: "LUNCH",
        expectedDiners: 100,
      },
    });

    await prisma.cookingPlan.create({
      data: {
        kitchenId: testKitchenStaleId,
        mealId: mealStale.id,
        expectedDiners: 100,
        status: "APPROVED",
        approvalStatus: "APPROVED",
        firstApprovedAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
      },
    });

    // 3. Empty Kitchen has no meals, plans, or observations
  });

  afterAll(async () => {
    const kIds = [testKitchenFreshId, testKitchenStaleId, testKitchenEmptyId];
    await prisma.planItem.deleteMany({ where: { plan: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.cookingPlan.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: { in: kIds } } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: { in: kIds } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: kIds } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});
  });

  describe("1. Utility functions: formatRelativeTime & isCloseoutStale", () => {
    it("formats relative times truthfully without fake claims", () => {
      expect(formatRelativeTime(null, "No closeout yet")).toBe("No closeout yet");
      expect(formatRelativeTime(undefined)).toBe("None yet");

      const now = Date.now();
      expect(formatRelativeTime(new Date(now - 30 * 1000))).toBe("Just now");
      expect(formatRelativeTime(new Date(now - 15 * 60 * 1000))).toBe("15m ago");
      expect(formatRelativeTime(new Date(now - 3 * 3600 * 1000))).toBe("3h ago");
      expect(formatRelativeTime(new Date(now - 36 * 3600 * 1000))).toBe("Yesterday");
      expect(formatRelativeTime(new Date(now - 4 * 24 * 3600 * 1000))).toBe("4d ago");
    });

    it("formats exact date-time for tooltip title", () => {
      expect(formatExactDateTime(null)).toBeNull();
      const exact = formatExactDateTime(new Date("2026-11-14T10:30:00Z"));
      expect(exact).toContain("2026");
      expect(exact).toContain("Nov");
    });

    it("evaluates stale closeout heuristic accurately (>= 48h since approval without closeout)", () => {
      const now = new Date("2026-11-16T12:00:00Z");

      // No plan approved -> not stale
      expect(isCloseoutStale(null, null, now)).toBe(false);

      // Plan approved 5 hours ago -> not stale (even without closeout)
      const recentPlan = new Date("2026-11-16T07:00:00Z");
      expect(isCloseoutStale(null, recentPlan, now)).toBe(false);

      // Plan approved 3 days ago with NO closeout -> STALE
      const oldPlan = new Date("2026-11-13T10:00:00Z");
      expect(isCloseoutStale(null, oldPlan, now)).toBe(true);

      // Plan approved 3 days ago, and closeout logged yesterday -> NOT stale
      const freshCloseout = new Date("2026-11-15T18:00:00Z");
      expect(isCloseoutStale(freshCloseout, oldPlan, now)).toBe(false);

      // Plan approved 3 days ago, but closeout was 4 days ago -> STALE
      const ancientCloseout = new Date("2026-11-12T18:00:00Z");
      expect(isCloseoutStale(ancientCloseout, oldPlan, now)).toBe(true);
    });

    it("determines baseline readiness threshold (>= 3 eligible observations)", () => {
      expect(isBaselineReady(0)).toBe(false);
      expect(isBaselineReady(1)).toBe(false);
      expect(isBaselineReady(2)).toBe(false);
      expect(isBaselineReady(3)).toBe(true);
      expect(isBaselineReady(10)).toBe(true);
    });
  });

  describe("2. getKitchenReliabilitySignal (Kitchen Level)", () => {
    it("returns truthful signals for a kitchen with fresh closeout and baseline", async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: true,
        user: { id: "u-1", email: "hc@test.com", role: "HEAD_COOK", contractorId: testContractorId } as any,
        kitchenId: testKitchenFreshId,
      });

      const res = await getKitchenReliabilitySignal(testKitchenFreshId);
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.kitchenId).toBe(testKitchenFreshId);
      expect(res.data.kitchenName).toBe("Fresh Central Kitchen");
      expect(res.data.eligibleObservationCount).toBe(3);
      expect(res.data.isBaselineReady).toBe(true);
      expect(res.data.isStale).toBe(false);
      expect(res.data.lastCloseoutAt).not.toBeNull();
      expect(res.data.lastPlanApprovedAt).not.toBeNull();
      expect(res.data.lastCloseoutRelative).toMatch(/(Just now|\d+m ago|\d+h ago)/);
    });

    it("returns 'No closeout yet' and not baseline ready for an empty kitchen", async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: true,
        user: { id: "u-1", email: "hc@test.com", role: "HEAD_COOK", contractorId: testContractorId } as any,
        kitchenId: testKitchenEmptyId,
      });

      const res = await getKitchenReliabilitySignal(testKitchenEmptyId);
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.lastCloseoutAt).toBeNull();
      expect(res.data.lastCloseoutRelative).toBe("No closeout yet");
      expect(res.data.lastPlanApprovedAt).toBeNull();
      expect(res.data.lastPlanApprovedRelative).toBe("No approved plan yet");
      expect(res.data.eligibleObservationCount).toBe(0);
      expect(res.data.isBaselineReady).toBe(false);
      expect(res.data.isStale).toBe(false);
    });

    it("flags isStale=true when a plan was approved >= 48h ago without closeout", async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: true,
        user: { id: "u-1", email: "hc@test.com", role: "HEAD_COOK", contractorId: testContractorId } as any,
        kitchenId: testKitchenStaleId,
      });

      const res = await getKitchenReliabilitySignal(testKitchenStaleId);
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.data.isStale).toBe(true);
      expect(res.data.lastPlanApprovedAt).not.toBeNull();
      expect(res.data.lastCloseoutAt).toBeNull();
    });

    it("enforces tenant isolation and denies cross-kitchen unauthorized access", async () => {
      vi.mocked(requireKitchenAccess).mockResolvedValueOnce({
        success: false,
        error: "Access denied: Unauthorized kitchen access",
        statusCode: 403,
      });

      const res = await getKitchenReliabilitySignal("forbidden-kitchen-id");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.statusCode).toBe(403);
      }
    });
  });

  describe("3. getContractorKitchenReliability (Contractor Level)", () => {
    it("returns signals for all kitchens within the contractor", async () => {
      vi.mocked(requireContractorAccess).mockResolvedValueOnce({
        success: true,
        user: { id: "u-ctr", email: "admin@catering.com", role: "CONTRACTOR_ADMIN" } as any,
        contractorId: testContractorId,
      });

      const res = await getContractorKitchenReliability(testContractorId);
      expect(res.success).toBe(true);
      if (!res.success) return;

      const signals = res.data;
      expect(signals.length).toBeGreaterThanOrEqual(3);

      const freshSig = signals.find((s) => s.kitchenId === testKitchenFreshId);
      expect(freshSig).toBeDefined();
      expect(freshSig?.isBaselineReady).toBe(true);

      const staleSig = signals.find((s) => s.kitchenId === testKitchenStaleId);
      expect(staleSig).toBeDefined();
      expect(staleSig?.isStale).toBe(true);
    });

    it("enforces tenant isolation and rejects unauthorized contractor access", async () => {
      vi.mocked(requireContractorAccess).mockResolvedValueOnce({
        success: false,
        error: "Access denied to contractor organization",
        statusCode: 403,
      });

      const res = await getContractorKitchenReliability("other-contractor-org");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.statusCode).toBe(403);
      }
    });
  });

  describe("4. getFounderKitchenReliability (Platform Level)", () => {
    it("returns platform-wide signals when founder calls action", async () => {
      vi.mocked(requireFounder).mockResolvedValueOnce({
        success: true,
        user: { id: "u-founder", email: "founder@cookcue.com", role: "FOUNDER" } as any,
      });

      const res = await getFounderKitchenReliability();
      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.some((k) => k.kitchenId === testKitchenFreshId)).toBe(true);
    });

    it("denies access when non-founder calls action", async () => {
      vi.mocked(requireFounder).mockResolvedValueOnce({
        success: false,
        error: "Founder authorization required",
      });

      const res = await getFounderKitchenReliability();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Founder authorization required");
      }
    });
  });
});
