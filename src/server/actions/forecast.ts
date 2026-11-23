"use server";

import { prisma } from "@/lib/prisma";
import { computeRecommendation } from "@/lib/domain/recommendation";
import type { ObservationInput } from "@/lib/domain/recommendation";
import { requireKitchenAccess, requireFounder } from "@/lib/auth/session";

import {
  executeForecastPrecompute,
  getDefaultExpectedDinersFromHistory,
  type PrecomputeForecastResult,
} from "@/server/forecast-engine";

export type { PrecomputeForecastResult };

export type PrecomputedSnapshotItem = {
  id: string;
  dishId: string;
  dishName: string;
  recommendedKg: number | null;
  eligibleCount: number;
  expectedDiners: number;
  computedAt: string;
};

/**
 * Server Action: Founder or Operator triggered Forecast Job
 * Never displays secrets; returns only counts and operational status.
 */
export async function runForecastPrecomputeJob(input?: {
  kitchenId?: string;
  mealTypes?: string[];
  expectedDiners?: number;
}): Promise<
  | { success: true; data: PrecomputeForecastResult }
  | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const result = await executeForecastPrecompute(input);
    return { success: true, data: result };
  } catch (e: any) {
    return { success: false, error: "Failed to execute forecast precompute job" };
  }
}

/**
 * Fetch latest precomputed forecast snapshots for a kitchen and meal service.
 */
export async function getLatestForecastSnapshots(
  kitchenId: string,
  mealType: string
): Promise<
  | {
      success: true;
      data: PrecomputedSnapshotItem[];
      latestComputedAt: string | null;
      expectedDiners: number | null;
    }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    // 1. Find the latest snapshot timestamp for this kitchen and mealType
    const latestRecord = await prisma.forecastSnapshot.findFirst({
      where: { kitchenId, mealType },
      orderBy: { computedAt: "desc" },
      select: { computedAt: true, expectedDiners: true },
    });

    if (!latestRecord) {
      return {
        success: true,
        data: [],
        latestComputedAt: null,
        expectedDiners: null,
      };
    }

    // 2. Fetch all snapshots generated at this batch timestamp
    const snapshots = await prisma.forecastSnapshot.findMany({
      where: {
        kitchenId,
        mealType,
        computedAt: latestRecord.computedAt,
      },
      include: {
        dish: { select: { id: true, name: true } },
      },
      orderBy: { dish: { name: "asc" } },
    });

    const items: PrecomputedSnapshotItem[] = snapshots.map((s) => ({
      id: s.id,
      dishId: s.dishId,
      dishName: s.dish.name,
      recommendedKg: s.recommendedKg,
      eligibleCount: s.eligibleCount,
      expectedDiners: s.expectedDiners,
      computedAt: s.computedAt.toISOString(),
    }));

    return {
      success: true,
      data: items,
      latestComputedAt: latestRecord.computedAt.toISOString(),
      expectedDiners: latestRecord.expectedDiners,
    };
  } catch (e) {
    return { success: false, error: "Failed to load precomputed forecast snapshots" };
  }
}

export async function getKitchenObservationStats(
  kitchenId: string
): Promise<
  | {
      success: true;
      data: {
        totalObservations: number;
        eligibleObservations: number;
        dishes: {
          dishId: string;
          dishName: string;
          observationCount: number;
          lastServedPerDiner: number | null;
        }[];
      };
    }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const observations = await prisma.observation.findMany({
      where: { kitchenId },
      include: { dish: true, meal: true },
      orderBy: { createdAt: "desc" },
    });

    const dishMap = new Map<
      string,
      { name: string; count: number; lastServed: number | null }
    >();

    let eligible = 0;

    for (const o of observations) {
      const key = o.dishId;
      if (!dishMap.has(key)) {
        dishMap.set(key, { name: o.dish.name, count: 0, lastServed: null });
      }
      const entry = dishMap.get(key)!;
      entry.count += 1;

      const isEligible = o.eligibilityStatus
        ? o.eligibilityStatus === "ELIGIBLE"
        : !o.isStockout &&
          !o.isAbnormal &&
          !o.isExcluded &&
          o.totalCookedKg !== null &&
          o.unservedLeftoverKg !== null &&
          o.actualDiners !== null &&
          o.actualDiners > 0 &&
          o.unservedLeftoverKg <= o.totalCookedKg;

      if (isEligible) {
        eligible += 1;
        if (o.totalCookedKg !== null && o.unservedLeftoverKg !== null && o.actualDiners && o.actualDiners > 0) {
          const served = o.totalCookedKg - o.unservedLeftoverKg;
          entry.lastServed = served / o.actualDiners;
        }
      }
    }

    const dishes = Array.from(dishMap.entries()).map(([dishId, v]) => ({
      dishId,
      dishName: v.name,
      observationCount: v.count,
      lastServedPerDiner: v.lastServed,
    }));

    return {
      success: true,
      data: {
        totalObservations: observations.length,
        eligibleObservations: eligible,
        dishes,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to load observation stats" };
  }
}

export async function forecastForKitchen(
  kitchenId: string,
  mealType: string,
  expectedDiners?: number
): Promise<
  | {
      success: true;
      data: {
        dishId: string;
        dishName: string;
        recommendedKg: number | null;
        eligibleCount: number;
        exclusionReasons: string[];
        servedPerDiner: number | null;
        status: string;
        statusReason?: string;
      }[];
    }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  const effectiveExpectedDiners =
    typeof expectedDiners === "number" && expectedDiners > 0
      ? expectedDiners
      : await getDefaultExpectedDinersFromHistory(kitchenId, mealType);

  try {
    const dishes = await prisma.dish.findMany({
      where: { kitchenId },
      select: { id: true, name: true },
    });

    const results = [];

    for (const dish of dishes) {
      const observations = await prisma.observation.findMany({
        where: {
          kitchenId,
          dishId: dish.id,
          meal: { mealType },
        },
        include: { meal: true },
      });

      const inputs: ObservationInput[] = observations.map((o) => ({
        serviceId: o.mealId,
        kitchenId: o.kitchenId,
        mealType: o.meal.mealType,
        dishId: o.dishId,
        totalCookedKg: o.totalCookedKg,
        unservedLeftoverKg: o.unservedLeftoverKg,
        actualDiners: o.actualDiners,
        isStockout: o.isStockout,
        isAbnormal: o.isAbnormal,
        isExcluded: o.isExcluded,
        exclusionReason: o.exclusionReason,
        eligibilityStatus: o.eligibilityStatus,
      }));

      const rec = computeRecommendation(
        inputs,
        { kitchenId, mealType, dishId: dish.id, expectedDiners: effectiveExpectedDiners },
        { minimumEligibleObservations: 3 }
      );

      results.push({
        dishId: dish.id,
        dishName: dish.name,
        recommendedKg: rec.recommendedKg,
        eligibleCount: rec.eligibleCount,
        exclusionReasons: rec.exclusionReasons,
        servedPerDiner: rec.servedPerDiner,
        status: rec.status,
        statusReason: rec.statusReason,
      });
    }

    return { success: true, data: results };
  } catch (e) {
    return { success: false, error: "Failed to generate forecast" };
  }
}
