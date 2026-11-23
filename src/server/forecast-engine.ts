import { prisma } from "@/lib/prisma";
import { computeRecommendation } from "@/lib/domain/recommendation";
import type { ObservationInput } from "@/lib/domain/recommendation";

export type PrecomputeForecastResult = {
  kitchensProcessed: number;
  snapshotsCreated: number;
  durationMs: number;
  errors?: string[];
};

export const FORECAST_CHUNK_SIZE = 50;

/**
 * Resolves baseline expected diners dynamically from past kitchen observations or meal records.
 * Falls back to 100 if the kitchen has no prior service history.
 */
export async function getDefaultExpectedDinersFromHistory(
  kitchenId: string,
  mealType?: string
): Promise<number> {
  try {
    // 1. Average actual diners from recent observations
    const recentObs = await prisma.observation.findMany({
      where: {
        kitchenId,
        actualDiners: { not: null, gt: 0 },
        ...(mealType ? { meal: { mealType } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { actualDiners: true },
    });

    if (recentObs.length > 0) {
      const sum = recentObs.reduce((acc, o) => acc + (o.actualDiners || 0), 0);
      const avg = Math.round(sum / recentObs.length);
      if (avg > 0) return avg;
    }

    // 2. Fallback to recent planned expected diners
    const recentMeal = await prisma.meal.findFirst({
      where: {
        kitchenId,
        expectedDiners: { not: null, gt: 0 },
        ...(mealType ? { mealType } : {}),
      },
      orderBy: { date: "desc" },
      select: { expectedDiners: true },
    });

    if (recentMeal?.expectedDiners && recentMeal.expectedDiners > 0) {
      return recentMeal.expectedDiners;
    }
  } catch {
    // Fail-safe fallback on DB error
  }

  return 100;
}

/**
 * Pure Domain Forecast Precompute Execution
 * Runs pure computeRecommendation across active kitchens and configured meal types.
 * Pure engine only — zero ML, zero safety buffers.
 * Internal server engine function (not exposed as an unauthenticated Next.js server action).
 *
 * ARC-01: Batched data loading in controlled chunks (e.g. 50 kitchens/chunk) to eliminate
 * N * M * D sequential query storms.
 */
export async function executeForecastPrecompute(input?: {
  kitchenId?: string;
  mealTypes?: string[];
  expectedDiners?: number;
  chunkSize?: number;
}): Promise<PrecomputeForecastResult> {
  const startTime = Date.now();
  const mealTypes =
    input?.mealTypes && input.mealTypes.length > 0
      ? input.mealTypes
      : ["BREAKFAST", "LUNCH", "DINNER"];
  const fixedExpectedDiners =
    typeof input?.expectedDiners === "number" && input.expectedDiners > 0
      ? input.expectedDiners
      : undefined;
  const chunkSize =
    input?.chunkSize && input.chunkSize > 0 ? input.chunkSize : FORECAST_CHUNK_SIZE;

  // 1. Fetch targeted ACTIVE kitchens
  const kitchens = await prisma.kitchen.findMany({
    where: {
      ...(input?.kitchenId ? { id: input.kitchenId } : {}),
      status: "ACTIVE",
    },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  let snapshotsCreated = 0;
  const errors: string[] = [];
  const now = new Date();

  // 2. Process kitchens in controlled chunks
  for (let i = 0; i < kitchens.length; i += chunkSize) {
    const chunk = kitchens.slice(i, i + chunkSize);
    const chunkKitchenIds = chunk.map((k) => k.id);

    try {
      // Step A: Bulk load active dishes for this chunk (1 query)
      const dishes = await prisma.dish.findMany({
        where: { kitchenId: { in: chunkKitchenIds } },
        select: { id: true, name: true, kitchenId: true },
        orderBy: { name: "asc" },
      });

      if (dishes.length === 0) {
        continue;
      }

      // Step B: Bulk load eligible observations for this chunk (1 query)
      const observations = await prisma.observation.findMany({
        where: {
          kitchenId: { in: chunkKitchenIds },
          meal: { mealType: { in: mealTypes } },
        },
        include: {
          meal: {
            select: { mealType: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Step C: If fixedExpectedDiners is not supplied, load recent planned meals for diner fallback (1 query)
      let recentMeals: Array<{
        kitchenId: string;
        mealType: string;
        expectedDiners: number | null;
      }> = [];
      if (!fixedExpectedDiners) {
        recentMeals = await prisma.meal.findMany({
          where: {
            kitchenId: { in: chunkKitchenIds },
            mealType: { in: mealTypes },
            expectedDiners: { not: null, gt: 0 },
          },
          orderBy: { date: "desc" },
          select: {
            kitchenId: true,
            mealType: true,
            expectedDiners: true,
          },
        });
      }

      // Step D: In-memory indexing
      // 1. Group dishes by kitchenId
      const dishesByKitchen = new Map<string, Array<{ id: string; name: string; kitchenId: string }>>();
      for (const dish of dishes) {
        let list = dishesByKitchen.get(dish.kitchenId);
        if (!list) {
          list = [];
          dishesByKitchen.set(dish.kitchenId, list);
        }
        list.push(dish);
      }

      // 2. Group observations by `${kitchenId}:${mealType}:${dishId}`
      const observationsByKey = new Map<string, ObservationInput[]>();
      // Also collect recent actual diners by `${kitchenId}:${mealType}` for dynamic fallback
      const recentActualDinersByKitchenMeal = new Map<string, number[]>();

      for (const o of observations) {
        const dishKey = `${o.kitchenId}:${o.meal.mealType}:${o.dishId}`;
        let obsList = observationsByKey.get(dishKey);
        if (!obsList) {
          obsList = [];
          observationsByKey.set(dishKey, obsList);
        }
        obsList.push({
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
        });

        if (o.actualDiners && o.actualDiners > 0) {
          const dinerKey = `${o.kitchenId}:${o.meal.mealType}`;
          let dinerList = recentActualDinersByKitchenMeal.get(dinerKey);
          if (!dinerList) {
            dinerList = [];
            recentActualDinersByKitchenMeal.set(dinerKey, dinerList);
          }
          if (dinerList.length < 10) {
            dinerList.push(o.actualDiners);
          }
        }
      }

      // 3. Index fallback meals by `${kitchenId}:${mealType}`
      const fallbackMealDiners = new Map<string, number>();
      for (const m of recentMeals) {
        const key = `${m.kitchenId}:${m.mealType}`;
        if (!fallbackMealDiners.has(key) && m.expectedDiners && m.expectedDiners > 0) {
          fallbackMealDiners.set(key, m.expectedDiners);
        }
      }

      // Step E: Pure computeRecommendation evaluation in memory
      const snapshotsToCreate: {
        kitchenId: string;
        mealType: string;
        dishId: string;
        recommendedKg: number | null;
        eligibleCount: number;
        expectedDiners: number;
        computedAt: Date;
      }[] = [];

      for (const kitchen of chunk) {
        const kitchenDishes = dishesByKitchen.get(kitchen.id) || [];
        if (kitchenDishes.length === 0) continue;

        for (const mealType of mealTypes) {
          // Resolve expected diners
          let diners = fixedExpectedDiners;
          if (!diners) {
            const dinerKey = `${kitchen.id}:${mealType}`;
            const actualList = recentActualDinersByKitchenMeal.get(dinerKey);
            if (actualList && actualList.length > 0) {
              const sum = actualList.reduce((acc, v) => acc + v, 0);
              const avg = Math.round(sum / actualList.length);
              if (avg > 0) diners = avg;
            }
          }
          if (!diners) {
            const dinerKey = `${kitchen.id}:${mealType}`;
            const planned = fallbackMealDiners.get(dinerKey);
            if (planned && planned > 0) diners = planned;
          }
          if (!diners) {
            diners = 100;
          }

          for (const dish of kitchenDishes) {
            const dishKey = `${kitchen.id}:${mealType}:${dish.id}`;
            const inputs = observationsByKey.get(dishKey) || [];

            const rec = computeRecommendation(
              inputs,
              {
                kitchenId: kitchen.id,
                mealType,
                dishId: dish.id,
                expectedDiners: diners,
              },
              { minimumEligibleObservations: 3 }
            );

            snapshotsToCreate.push({
              kitchenId: kitchen.id,
              mealType,
              dishId: dish.id,
              recommendedKg: rec.recommendedKg,
              eligibleCount: rec.eligibleCount,
              expectedDiners: diners,
              computedAt: now,
            });
          }
        }
      }

      // Step F: Bulk insert snapshots in controlled slices
      if (snapshotsToCreate.length > 0) {
        const BATCH_INSERT_SIZE = 1000;
        for (let s = 0; s < snapshotsToCreate.length; s += BATCH_INSERT_SIZE) {
          const slice = snapshotsToCreate.slice(s, s + BATCH_INSERT_SIZE);
          await prisma.forecastSnapshot.createMany({
            data: slice,
          });
        }
        snapshotsCreated += snapshotsToCreate.length;
      }
    } catch (err: any) {
      errors.push(
        `Error precomputing chunk [${chunkKitchenIds.join(", ")}]: ${
          err?.message || "Unknown error"
        }`
      );
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    kitchensProcessed: kitchens.length,
    snapshotsCreated,
    durationMs,
    ...(errors.length > 0 ? { errors } : {}),
  };
}
