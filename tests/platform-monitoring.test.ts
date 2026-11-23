import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { getPlatformMonitoringSummary } from "../src/server/actions/monitoring";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";

vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
  };
});

import { requireFounder } from "../src/lib/auth/session";

describe("ARC-02 Platform Monitoring Aggregation", () => {
  const testKitchenId = "test-monitoring-fixture-kitchen";
  const testContractorId = "test-monitoring-fixture-ctr";
  const testDishId = "test-monitoring-fixture-dish";

  beforeAll(async () => {
    // Clean up
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: testKitchenId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: {
        id: testContractorId,
        code: ctrCode,
        name: "Monitoring Test Contractor",
        status: "ACTIVE",
        kitchens: {
          create: [
            {
              id: testKitchenId,
              name: "Monitoring Test Kitchen",
              status: "ACTIVE",
            },
          ],
        },
      },
    });

    await prisma.dish.create({
      data: {
        id: testDishId,
        kitchenId: testKitchenId,
        name: "Test Dal",
        unit: "kg",
      },
    });

    const meal = await prisma.meal.create({
      data: {
        kitchenId: testKitchenId,
        mealType: "LUNCH",
        date: new Date("2026-11-25T00:00:00Z"),
      },
    });

    await prisma.observation.create({
      data: {
        kitchenId: testKitchenId,
        mealId: meal.id,
        dishId: testDishId,
        totalCookedKg: 25.0,
        unservedLeftoverKg: 2.0,
        actualDiners: 100,
        isStockout: true,
        isAbnormal: false,
        isExcluded: false,
        eligibilityStatus: "ELIGIBLE",
      },
    });
  });

  afterAll(async () => {
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: testKitchenId } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: testKitchenId } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: testKitchenId } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});
  });

  beforeEach(() => {
    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: "test-monitoring-founder",
        email: "founder@cookcue.com",
        name: "Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });
  });

  it("1. Rejects unauthenticated / non-founder requests with 403", async () => {
    vi.mocked(requireFounder).mockResolvedValueOnce({
      success: false,
      error: "Founder authorization required",
      statusCode: 403,
    });

    const res = await getPlatformMonitoringSummary();
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("Founder authorization required");
    }
  });

  it("2. Returns accurate and consistent platform metrics matching live DB counts", async () => {
    const res = await getPlatformMonitoringSummary();
    expect(res.success).toBe(true);
    if (!res.success) return;

    const data = res.data;

    // Verify against direct live DB count queries
    const expectedKitchenCount = await prisma.kitchen.count();
    const expectedActiveKitchenCount = await prisma.kitchen.count({ where: { status: "ACTIVE" } });
    const expectedObservationCount = await prisma.observation.count();
    const expectedStockouts = await prisma.observation.count({ where: { isStockout: true } });
    const expectedAbnormal = await prisma.observation.count({ where: { isAbnormal: true } });

    expect(data.totalKitchens).toBe(expectedKitchenCount);
    expect(data.totalActiveKitchens).toBe(expectedActiveKitchenCount);
    expect(data.totalObservations).toBe(expectedObservationCount);
    expect(data.totalStockouts).toBe(expectedStockouts);
    expect(data.totalAbnormal).toBe(expectedAbnormal);
    expect(data.kitchens.length).toBe(expectedKitchenCount);

    // Verify test fixture kitchen summary details
    const fixtureKitchen = data.kitchens.find((k) => k.kitchenId === testKitchenId);
    expect(fixtureKitchen).toBeDefined();
    expect(fixtureKitchen?.kitchenName).toBe("Monitoring Test Kitchen");
    expect(fixtureKitchen?.status).toBe("ACTIVE");
    expect(fixtureKitchen?.observationCount).toBe(1);
    expect(fixtureKitchen?.stockoutCount).toBe(1);
    expect(fixtureKitchen?.abnormalCount).toBe(0);
    expect(fixtureKitchen?.lastCloseoutAt).not.toBeNull();
  });

  it("3. Pushes aggregation to PostgreSQL and does NOT load all observation rows into Node memory", async () => {
    // Spy on prisma.observation.findMany
    const obsFindManySpy = vi.spyOn(prisma.observation, "findMany");

    const res = await getPlatformMonitoringSummary();
    expect(res.success).toBe(true);

    // In the scalable architecture, observation rows are aggregated in PostgreSQL (count & groupBy)
    // rather than fetched into Node memory via prisma.observation.findMany.
    expect(obsFindManySpy).not.toHaveBeenCalled();

    obsFindManySpy.mockRestore();
  });
});
