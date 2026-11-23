import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../src/lib/prisma";
import { executeForecastPrecompute } from "../src/server/forecast-engine";
import { generateNextContractorCode } from "../src/server/actions/contractor-code";
import {
  runForecastPrecomputeJob,
  getLatestForecastSnapshots,
} from "../src/server/actions/forecast";

// Mock auth session guards
vi.mock("../src/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/session")>();
  return {
    ...actual,
    requireFounder: vi.fn(),
    requireKitchenAccess: vi.fn(),
  };
});

import { requireFounder, requireKitchenAccess } from "../src/lib/auth/session";

describe("Lightweight Forecast Precompute Path", () => {
  const testKitchenId = "test-forecast-job-kitchen";
  const testKitchen2Id = "test-forecast-job-kitchen-2";
  const testContractorId = "test-forecast-job-contractor";
  let dish1Id: string;
  let dish2Id: string;

  beforeEach(async () => {
    vi.mocked(requireFounder).mockResolvedValue({
      success: true,
      user: {
        id: "test-forecast-founder",
        email: "founder@cookcue.com",
        name: "Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: null,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    vi.mocked(requireKitchenAccess).mockResolvedValue({
      success: true,
      user: {
        id: "test-forecast-founder",
        email: "founder@cookcue.com",
        name: "Founder",
        role: "FOUNDER",
        contractorId: null,
        kitchenId: testKitchenId,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      },
    });

    // Clean previous records
    await prisma.forecastSnapshot.deleteMany({ where: { kitchenId: { in: [testKitchenId, testKitchen2Id] } } }).catch(() => {});
    await prisma.observationAudit.deleteMany({ where: { observation: { kitchenId: { in: [testKitchenId, testKitchen2Id] } } } }).catch(() => {});
    await prisma.observation.deleteMany({ where: { kitchenId: { in: [testKitchenId, testKitchen2Id] } } }).catch(() => {});
    await prisma.dish.deleteMany({ where: { kitchenId: { in: [testKitchenId, testKitchen2Id] } } }).catch(() => {});
    await prisma.meal.deleteMany({ where: { kitchenId: { in: [testKitchenId, testKitchen2Id] } } }).catch(() => {});
    await prisma.kitchen.deleteMany({ where: { id: { in: [testKitchenId, testKitchen2Id] } } }).catch(() => {});
    await prisma.contractor.deleteMany({ where: { id: testContractorId } }).catch(() => {});

    // Provision contractor & active kitchen
    const ctrCode = await generateNextContractorCode();
    await prisma.contractor.create({
      data: { id: testContractorId, code: ctrCode, name: "Forecast Test Catering", status: "ACTIVE" },
    });

    await prisma.kitchen.create({
      data: { id: testKitchenId, contractorId: testContractorId, name: "Forecast Central Station", status: "ACTIVE" },
    });

    const d1 = await prisma.dish.create({
      data: { kitchenId: testKitchenId, name: "Vegetable Biryani", unit: "kg" },
    });
    const d2 = await prisma.dish.create({
      data: { kitchenId: testKitchenId, name: "Raita", unit: "kg" },
    });
    dish1Id = d1.id;
    dish2Id = d2.id;

    // Create 3 normal eligible observations for Biryani at LUNCH
    for (let i = 1; i <= 3; i++) {
      const meal = await prisma.meal.create({
        data: {
          kitchenId: testKitchenId,
          mealType: "LUNCH",
          date: new Date(`2026-11-0${i}T00:00:00.000Z`),
          expectedDiners: 100,
        },
      });

      await prisma.observation.create({
        data: {
          kitchenId: testKitchenId,
          mealId: meal.id,
          dishId: dish1Id,
          totalCookedKg: 30.0,
          unservedLeftoverKg: 5.0, // 25kg served
          actualDiners: 100, // 0.25 kg/diner
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
        },
      });
    }
  });

  it("1. Executes pure forecast precompute and stores ForecastSnapshot records with pure math", async () => {
    const result = await executeForecastPrecompute({
      kitchenId: testKitchenId,
      mealTypes: ["LUNCH"],
      expectedDiners: 120,
    });

    expect(result.kitchensProcessed).toBe(1);
    expect(result.snapshotsCreated).toBe(2); // 2 dishes for LUNCH
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Verify stored ForecastSnapshot rows
    const snapshots = await prisma.forecastSnapshot.findMany({
      where: { kitchenId: testKitchenId, mealType: "LUNCH" },
      orderBy: { dishId: "asc" },
    });

    expect(snapshots.length).toBe(2);

    const biryaniSnapshot = snapshots.find((s) => s.dishId === dish1Id);
    expect(biryaniSnapshot).toBeDefined();
    expect(biryaniSnapshot?.eligibleCount).toBe(3);
    expect(biryaniSnapshot?.expectedDiners).toBe(120);
    // 0.25 kg/diner * 120 diners = 30.0 kg (Pure engine: NO safety buffers, NO ML)
    expect(biryaniSnapshot?.recommendedKg).toBe(30.0);
    expect(biryaniSnapshot?.computedAt).toBeInstanceOf(Date);

    // Dish 2 has 0 observations -> insufficient history -> recommendedKg is null
    const raitaSnapshot = snapshots.find((s) => s.dishId === dish2Id);
    expect(raitaSnapshot).toBeDefined();
    expect(raitaSnapshot?.eligibleCount).toBe(0);
    expect(raitaSnapshot?.recommendedKg).toBeNull();
  });

  it("2. Server Action runForecastPrecomputeJob enforces Founder authorization", async () => {
    vi.mocked(requireFounder).mockResolvedValueOnce({
      success: false,
      error: "Founder authorization required",
      statusCode: 403,
    });

    const res = await runForecastPrecomputeJob({ kitchenId: testKitchenId });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("Founder authorization required");
    }
  });

  it("3. Reads latest forecast precomputed snapshot in getLatestForecastSnapshots", async () => {
    // Generate precomputed snapshot
    await executeForecastPrecompute({
      kitchenId: testKitchenId,
      mealTypes: ["LUNCH"],
      expectedDiners: 150,
    });

    const res = await getLatestForecastSnapshots(testKitchenId, "LUNCH");
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.length).toBe(2);
    expect(res.expectedDiners).toBe(150);
    expect(res.latestComputedAt).not.toBeNull();

    const biryaniItem = res.data.find((d) => d.dishId === dish1Id);
    expect(biryaniItem).toBeDefined();
    // 0.25 kg/diner * 150 diners = 37.5 kg
    expect(biryaniItem?.recommendedKg).toBe(37.5);
    expect(biryaniItem?.eligibleCount).toBe(3);
  });

  it("4. ARC-01: Batched data loading eliminates sequential query-per-dish storm across kitchens", async () => {
    // Provision second kitchen with dish and observations
    await prisma.kitchen.create({
      data: { id: testKitchen2Id, contractorId: testContractorId, name: "Forecast Second Station", status: "ACTIVE" },
    });

    const d3 = await prisma.dish.create({
      data: { kitchenId: testKitchen2Id, name: "Dal Tadka", unit: "kg" },
    });

    for (let i = 1; i <= 3; i++) {
      const meal = await prisma.meal.create({
        data: {
          kitchenId: testKitchen2Id,
          mealType: "LUNCH",
          date: new Date(`2026-11-0${i}T00:00:00.000Z`),
          expectedDiners: 100,
        },
      });

      await prisma.observation.create({
        data: {
          kitchenId: testKitchen2Id,
          mealId: meal.id,
          dishId: d3.id,
          totalCookedKg: 20.0,
          unservedLeftoverKg: 2.0, // 18kg served
          actualDiners: 100, // 0.18 kg/diner
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
        },
      });
    }

    // Spy on prisma.dish.findMany and prisma.observation.findMany to verify batched loading
    const dishSpy = vi.spyOn(prisma.dish, "findMany");
    const obsSpy = vi.spyOn(prisma.observation, "findMany");

    const totalActiveKitchens = await prisma.kitchen.count({ where: { status: "ACTIVE" } });
    const expectedChunks = Math.ceil(totalActiveKitchens / 50);

    const result = await executeForecastPrecompute({
      mealTypes: ["LUNCH"],
      expectedDiners: 100,
    });

    // In batched mode, dishes and observations are loaded in bulk with `kitchenId: { in: [...] }`
    // exactly once per chunk (Math.ceil(totalKitchens / 50)), eliminating the sequential query-per-dish storm.
    expect(dishSpy).toHaveBeenCalledTimes(expectedChunks);
    const dishWhere = dishSpy.mock.calls[0]?.[0]?.where as any;
    expect(dishWhere?.kitchenId).toHaveProperty("in");

    expect(obsSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(obsSpy.mock.calls.length).toBeLessThanOrEqual(expectedChunks);
    const obsWhere = obsSpy.mock.calls[0]?.[0]?.where as any;
    expect(obsWhere?.kitchenId).toHaveProperty("in");

    // Verify recommendations were computed correctly for both kitchens in memory
    const k2Snapshots = await prisma.forecastSnapshot.findMany({
      where: { kitchenId: testKitchen2Id, mealType: "LUNCH" },
    });
    expect(k2Snapshots.length).toBe(1);
    expect(k2Snapshots[0].dishId).toBe(d3.id);
    expect(k2Snapshots[0].eligibleCount).toBe(3);
    // 0.18 kg/diner * 100 diners = 18.0 kg
    expect(k2Snapshots[0].recommendedKg).toBe(18.0);

    dishSpy.mockRestore();
    obsSpy.mockRestore();
  });
});
