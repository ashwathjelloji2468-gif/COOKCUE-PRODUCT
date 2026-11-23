"use server";

import { prisma } from "@/lib/prisma";
import { requireKitchenAccess, getSessionUser } from "@/lib/auth/session";
import { normalizeServiceDate } from "@/lib/domain/date";

export async function getApprovedPlanForMeal(
  kitchenId: string,
  mealType: string,
  date: string
): Promise<
  | {
      success: true;
      data: {
        planId: string;
        mealId: string;
        expectedDiners: number;
        items: {
          dishId: string;
          dishName: string;
          approvedKg: number | null;
          recommendedKg: number | null;
          snapshotBasisJson: string | null;
        }[];
      };
    }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const mealDate = normalizeServiceDate(date);

    const meal = await prisma.meal.findFirst({
      where: { kitchenId, mealType, date: mealDate },
      include: {
        cookingPlan: {
          include: {
            items: {
              include: { dish: true },
            },
          },
        },
      },
    });

    if (!meal || !meal.cookingPlan) {
      return { success: false, error: "No approved plan found for this meal" };
    }

    const plan = meal.cookingPlan;
    const planStatus = plan.approvalStatus || plan.status;

    if (planStatus !== "APPROVED") {
      return {
        success: false,
        error: "Cooking plan is not approved. Head Cook approval is required before recording closeout.",
      };
    }

    return {
      success: true,
      data: {
        planId: plan.id,
        mealId: meal.id,
        expectedDiners: plan.expectedDiners,
        items: plan.items.map((i) => ({
          dishId: i.dishId,
          dishName: i.dish.name,
          approvedKg: i.approvedKg,
          recommendedKg: i.recommendedKg,
          snapshotBasisJson: i.snapshotBasisJson,
        })),
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to load plan" };
  }
}

import { computeEligibilityStatus, type EligibilityStatus } from "@/lib/domain/eligibility";
import {
  calculateCloseoutVariance,
  calculateServedKg,
  isServiceObservationEligible,
  type CloseoutVarianceSummary,
  type HistoricalServiceInput,
} from "@/lib/domain/closeout-variance";
export type { EligibilityStatus, CloseoutVarianceSummary };

export async function submitCloseout(input: {
  kitchenId: string;
  mealId: string;
  actualDiners: number;
  items: {
    dishId: string;
    totalCookedKg: number | null;
    unservedLeftoverKg: number | null;
    isStockout: boolean;
    isAbnormal: boolean;
  }[];
}): Promise<
  | { success: true; variance?: CloseoutVarianceSummary }
  | { success: false; error: string }
> {
  const { kitchenId, mealId, actualDiners, items } = input;

  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  const session = await getSessionUser();

  if (actualDiners < 0 || !Number.isSafeInteger(actualDiners)) {
    return { success: false, error: "Actual diners must be a non-negative integer" };
  }

  // Ensure cooking plan is approved by Head Cook before allowing closeout
  const plan = await prisma.cookingPlan.findUnique({
    where: { mealId },
    include: { meal: true },
  });
  const planStatus = plan ? (plan.approvalStatus || plan.status) : null;
  if (!plan || planStatus !== "APPROVED") {
    return {
      success: false,
      error: "Cannot submit closeout: No approved cooking plan found for this meal service.",
    };
  }

  if (plan.kitchenId !== kitchenId || plan.meal?.kitchenId !== kitchenId) {
    return {
      success: false,
      error: "Forbidden: Cooking plan or meal service does not belong to this facility",
    };
  }

  // Verify all dishes belong to this kitchen
  const dishIds = items.map((i) => i.dishId);
  if (dishIds.length > 0) {
    const dishes = await prisma.dish.findMany({
      where: {
        id: { in: dishIds },
        kitchenId,
      },
      select: { id: true },
    });
    if (dishes.length !== dishIds.length) {
      return {
        success: false,
        error: "Forbidden: One or more dishes do not belong to this facility",
      };
    }
  }

  // Pre-validate quantities before touching database
  for (const item of items) {
    if (
      item.totalCookedKg !== null &&
      item.unservedLeftoverKg !== null &&
      item.unservedLeftoverKg > item.totalCookedKg
    ) {
      return {
        success: false,
        error: "Leftovers cannot exceed production for any dish",
      };
    }
    if (
      (item.totalCookedKg !== null && (!Number.isFinite(item.totalCookedKg) || item.totalCookedKg < 0)) ||
      (item.unservedLeftoverKg !== null && (!Number.isFinite(item.unservedLeftoverKg) || item.unservedLeftoverKg < 0))
    ) {
      return {
        success: false,
        error: "Production and leftover quantities must be non-negative finite numbers",
      };
    }
  }

  try {
    // Database-Enforced Unique Upsert with Audit Logging:
    // Uses @@unique([mealId, dishId]) to guarantee race-free concurrency control
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const eligibilityStatus = computeEligibilityStatus({
          totalCookedKg: item.totalCookedKg,
          unservedLeftoverKg: item.unservedLeftoverKg,
          actualDiners,
          isStockout: item.isStockout,
          isAbnormal: item.isAbnormal,
          isExcluded: false,
        });

        const existing = await tx.observation.findUnique({
          where: {
            mealId_dishId: {
              mealId,
              dishId: item.dishId,
            },
          },
        });

        if (existing) {
          // Record audit record if any editable observation field is modified/corrected
          const isChanged =
            existing.totalCookedKg !== item.totalCookedKg ||
            existing.unservedLeftoverKg !== item.unservedLeftoverKg ||
            existing.actualDiners !== actualDiners ||
            existing.isStockout !== item.isStockout ||
            existing.isAbnormal !== item.isAbnormal;

          if (isChanged) {
            await tx.observationAudit.create({
              data: {
                observationId: existing.id,
                previousCookedKg: existing.totalCookedKg,
                newCookedKg: item.totalCookedKg,
                previousLeftoverKg: existing.unservedLeftoverKg,
                newLeftoverKg: item.unservedLeftoverKg,
                previousActualDiners: existing.actualDiners,
                newActualDiners: actualDiners,
                previousStockout: existing.isStockout,
                newStockout: item.isStockout,
                previousAbnormal: existing.isAbnormal,
                newAbnormal: item.isAbnormal,
                previousExcluded: existing.isExcluded,
                newExcluded: false,
                previousExclusionReason: existing.exclusionReason,
                newExclusionReason: null,
                reason: "Closeout observation revised",
                changedByUserId: session?.id,
              },
            });
          }

          await tx.observation.update({
            where: {
              mealId_dishId: {
                mealId,
                dishId: item.dishId,
              },
            },
            data: {
              kitchenId,
              totalCookedKg: item.totalCookedKg,
              unservedLeftoverKg: item.unservedLeftoverKg,
              actualDiners,
              isStockout: item.isStockout,
              isAbnormal: item.isAbnormal,
              isExcluded: false,
              eligibilityStatus,
            },
          });
        } else {
          await tx.observation.upsert({
            where: {
              mealId_dishId: {
                mealId,
                dishId: item.dishId,
              },
            },
            create: {
              kitchenId,
              mealId,
              dishId: item.dishId,
              totalCookedKg: item.totalCookedKg,
              unservedLeftoverKg: item.unservedLeftoverKg,
              actualDiners,
              isStockout: item.isStockout,
              isAbnormal: item.isAbnormal,
              isExcluded: false,
              eligibilityStatus,
            },
            update: {
              kitchenId,
              totalCookedKg: item.totalCookedKg,
              unservedLeftoverKg: item.unservedLeftoverKg,
              actualDiners,
              isStockout: item.isStockout,
              isAbnormal: item.isAbnormal,
              isExcluded: false,
              eligibilityStatus,
            },
          });
        }
      }
    });

    const variance = await computeCloseoutVarianceInternal(kitchenId, mealId);
    return { success: true, variance: variance ?? undefined };
  } catch (e) {
    return { success: false, error: "Failed to submit closeout" };
  }
}

export async function getRecentCloseoutsForKitchen(
  kitchenId: string,
  limit: number = 10
): Promise<
  | {
      success: true;
      data: {
        id: string;
        date: string;
        mealType: string;
        actualDiners: number | null;
        dishName: string;
        cookedKg: number | null;
        leftoverKg: number | null;
        isStockout: boolean;
        isAbnormal: boolean;
      }[];
    }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const observations = await prisma.observation.findMany({
      where: { kitchenId },
      include: {
        dish: true,
        meal: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const data = observations.map((o) => ({
      id: o.id,
      date: o.meal.date.toISOString().slice(0, 10),
      mealType: o.meal.mealType,
      actualDiners: o.actualDiners,
      dishName: o.dish.name,
      cookedKg: o.totalCookedKg,
      leftoverKg: o.unservedLeftoverKg,
      isStockout: o.isStockout,
      isAbnormal: o.isAbnormal,
    }));

    return { success: true, data };
  } catch (e) {
    return { success: false, error: "Failed to load recent closeout records" };
  }
}

/**
 * Record a completed meal closeout directly without a prior morning plan.
 * Automatically creates or attaches to the Meal for that date/mealType.
 */
export async function createUnplannedMealCloseout(input: {
  kitchenId: string;
  mealType: string;
  date: string;
  actualDiners: number;
  items: {
    dishId: string;
    totalCookedKg: number | null;
    unservedLeftoverKg: number | null;
    isStockout: boolean;
    isAbnormal: boolean;
  }[];
}): Promise<
  | { success: true; mealId: string; variance?: CloseoutVarianceSummary }
  | { success: false; error: string }
> {
  const { kitchenId, mealType, date, actualDiners, items } = input;

  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  const session = await getSessionUser();

  if (actualDiners < 0 || !Number.isSafeInteger(actualDiners)) {
    return { success: false, error: "Actual diners must be a non-negative integer" };
  }

  // Pre-validate quantities
  for (const item of items) {
    if (
      item.totalCookedKg !== null &&
      item.unservedLeftoverKg !== null &&
      item.unservedLeftoverKg > item.totalCookedKg
    ) {
      return { success: false, error: "Leftovers cannot exceed production for any dish" };
    }
    if (
      (item.totalCookedKg !== null && (!Number.isFinite(item.totalCookedKg) || item.totalCookedKg < 0)) ||
      (item.unservedLeftoverKg !== null && (!Number.isFinite(item.unservedLeftoverKg) || item.unservedLeftoverKg < 0))
    ) {
      return { success: false, error: "Production and leftover quantities must be non-negative finite numbers" };
    }
  }

  // Verify all dishes belong to this kitchen
  const dishIds = items.map((i) => i.dishId);
  if (dishIds.length > 0) {
    const dishes = await prisma.dish.findMany({
      where: {
        id: { in: dishIds },
        kitchenId,
      },
      select: { id: true },
    });
    if (dishes.length !== dishIds.length) {
      return {
        success: false,
        error: "Forbidden: One or more dishes do not belong to this facility",
      };
    }
  }

  try {
    const mealDate = normalizeServiceDate(date);

    // Atomic find-or-create Meal with service-level idempotency
    const meal = await prisma.$transaction(async (tx) => {
      const targetMeal = await tx.meal.upsert({
        where: {
          kitchenId_mealType_date: {
            kitchenId,
            mealType,
            date: mealDate,
          },
        },
        update: {
          expectedDiners: actualDiners,
        },
        create: {
          kitchenId,
          mealType,
          date: mealDate,
          expectedDiners: actualDiners,
        },
      });

      for (const item of items) {
        const eligibilityStatus = computeEligibilityStatus({
          totalCookedKg: item.totalCookedKg,
          unservedLeftoverKg: item.unservedLeftoverKg,
          actualDiners,
          isStockout: item.isStockout,
          isAbnormal: item.isAbnormal,
          isExcluded: false,
        });

        const existing = await tx.observation.findUnique({
          where: {
            mealId_dishId: {
              mealId: targetMeal.id,
              dishId: item.dishId,
            },
          },
        });

        if (existing) {
          const isChanged =
            existing.totalCookedKg !== item.totalCookedKg ||
            existing.unservedLeftoverKg !== item.unservedLeftoverKg ||
            existing.actualDiners !== actualDiners ||
            existing.isStockout !== item.isStockout ||
            existing.isAbnormal !== item.isAbnormal;

          if (isChanged) {
            await tx.observationAudit.create({
              data: {
                observationId: existing.id,
                previousCookedKg: existing.totalCookedKg,
                newCookedKg: item.totalCookedKg,
                previousLeftoverKg: existing.unservedLeftoverKg,
                newLeftoverKg: item.unservedLeftoverKg,
                previousActualDiners: existing.actualDiners,
                newActualDiners: actualDiners,
                previousStockout: existing.isStockout,
                newStockout: item.isStockout,
                previousAbnormal: existing.isAbnormal,
                newAbnormal: item.isAbnormal,
                previousExcluded: existing.isExcluded,
                newExcluded: false,
                previousExclusionReason: existing.exclusionReason,
                newExclusionReason: null,
                reason: "Closeout observation revised (unplanned service)",
                changedByUserId: session?.id,
              },
            });
          }
        }

        await tx.observation.upsert({
          where: {
            mealId_dishId: {
              mealId: targetMeal.id,
              dishId: item.dishId,
            },
          },
          create: {
            kitchenId,
            mealId: targetMeal.id,
            dishId: item.dishId,
            totalCookedKg: item.totalCookedKg,
            unservedLeftoverKg: item.unservedLeftoverKg,
            actualDiners,
            isStockout: item.isStockout,
            isAbnormal: item.isAbnormal,
            isExcluded: false,
            eligibilityStatus,
          },
          update: {
            kitchenId,
            totalCookedKg: item.totalCookedKg,
            unservedLeftoverKg: item.unservedLeftoverKg,
            actualDiners,
            isStockout: item.isStockout,
            isAbnormal: item.isAbnormal,
            isExcluded: false,
            eligibilityStatus,
          },
        });
      }

      return targetMeal;
    });

    const variance = await computeCloseoutVarianceInternal(kitchenId, meal.id);
    return { success: true, mealId: meal.id, variance: variance ?? undefined };
  } catch (e) {
    return { success: false, error: "Failed to record unplanned meal closeout" };
  }
}

/**
 * Historical service review: retrieves closeout observations with full audit trail
 */
export async function getMealObservationsWithAudits(
  kitchenId: string,
  mealId: string
): Promise<
  | {
      success: true;
      data: {
        meal: { id: string; mealType: string; date: string; expectedDiners: number | null };
        observations: {
          id: string;
          dishId: string;
          dishName: string;
          totalCookedKg: number | null;
          unservedLeftoverKg: number | null;
          actualDiners: number | null;
          isStockout: boolean;
          isAbnormal: boolean;
          isExcluded: boolean;
          audits: {
            id: string;
            createdAt: string;
            previousCookedKg: number | null;
            newCookedKg: number | null;
            previousLeftoverKg: number | null;
            newLeftoverKg: number | null;
            previousActualDiners: number | null;
            newActualDiners: number | null;
            previousStockout: boolean | null;
            newStockout: boolean | null;
            previousAbnormal: boolean | null;
            newAbnormal: boolean | null;
            reason: string;
          }[];
        }[];
      };
    }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const meal = await prisma.meal.findUnique({
      where: { id: mealId },
      include: {
        observations: {
          include: {
            dish: true,
            audits: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!meal || meal.kitchenId !== kitchenId) {
      return { success: false, error: "Meal record not found" };
    }

    return {
      success: true,
      data: {
        meal: {
          id: meal.id,
          mealType: meal.mealType,
          date: meal.date.toISOString().slice(0, 10),
          expectedDiners: meal.expectedDiners,
        },
        observations: meal.observations.map((o) => ({
          id: o.id,
          dishId: o.dishId,
          dishName: o.dish.name,
          totalCookedKg: o.totalCookedKg,
          unservedLeftoverKg: o.unservedLeftoverKg,
          actualDiners: o.actualDiners,
          isStockout: o.isStockout,
          isAbnormal: o.isAbnormal,
          isExcluded: o.isExcluded,
          audits: o.audits.map((a) => ({
            id: a.id,
            createdAt: a.createdAt.toISOString(),
            previousCookedKg: a.previousCookedKg,
            newCookedKg: a.newCookedKg,
            previousLeftoverKg: a.previousLeftoverKg,
            newLeftoverKg: a.newLeftoverKg,
            previousActualDiners: a.previousActualDiners,
            newActualDiners: a.newActualDiners,
            previousStockout: a.previousStockout,
            newStockout: a.newStockout,
            previousAbnormal: a.previousAbnormal,
            newAbnormal: a.newAbnormal,
            reason: a.reason,
          })),
        })),
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to load meal observations" };
  }
}

export type LastCloseoutPrefillData = {
  date: string;
  mealType: string;
  mealId: string;
  actualDiners: number;
  items: {
    dishId: string;
    dishName: string;
    cookedKg: number | null;
    leftoverKg: number | null;
    isStockout: boolean;
    isAbnormal: boolean;
  }[];
};

export async function getLastCloseoutPrefill(
  kitchenId: string,
  mealType: string,
  date?: string
): Promise<
  | { success: true; data: LastCloseoutPrefillData | null }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const targetDate = date ? normalizeServiceDate(date) : undefined;
    const dateLtFilter = targetDate ? { lt: targetDate } : undefined;

    // 1. Primary preference: Last service with ELIGIBLE observation data strictly before targetDate (or latest if no date)
    let candidateMeal = await prisma.meal.findFirst({
      where: {
        kitchenId,
        mealType,
        ...(dateLtFilter ? { date: dateLtFilter } : {}),
        observations: {
          some: {
            eligibilityStatus: "ELIGIBLE",
            totalCookedKg: { not: null },
          },
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        observations: {
          where: { totalCookedKg: { not: null } },
          include: { dish: true },
        },
      },
    });

    // 2. Secondary fallback: Last service with any completed closeout data strictly before targetDate
    if (!candidateMeal || candidateMeal.observations.length === 0) {
      candidateMeal = await prisma.meal.findFirst({
        where: {
          kitchenId,
          mealType,
          ...(dateLtFilter ? { date: dateLtFilter } : {}),
          observations: {
            some: {
              totalCookedKg: { not: null },
            },
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: {
          observations: {
            where: { totalCookedKg: { not: null } },
            include: { dish: true },
          },
        },
      });
    }

    // 3. Fallback if targetDate was passed and no earlier service exists: check if any prior service exists not equal to targetDate
    if ((!candidateMeal || candidateMeal.observations.length === 0) && targetDate) {
      candidateMeal = await prisma.meal.findFirst({
        where: {
          kitchenId,
          mealType,
          date: { not: targetDate },
          observations: {
            some: {
              totalCookedKg: { not: null },
            },
          },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: {
          observations: {
            where: { totalCookedKg: { not: null } },
            include: { dish: true },
          },
        },
      });
    }

    if (!candidateMeal || candidateMeal.observations.length === 0) {
      return { success: true, data: null };
    }

    const obsWithDiners = candidateMeal.observations.find((o) => o.actualDiners != null);
    const diners = obsWithDiners?.actualDiners ?? candidateMeal.expectedDiners ?? 100;

    return {
      success: true,
      data: {
        date: candidateMeal.date.toISOString().slice(0, 10),
        mealType: candidateMeal.mealType,
        mealId: candidateMeal.id,
        actualDiners: diners,
        items: candidateMeal.observations.map((o) => ({
          dishId: o.dishId,
          dishName: o.dish.name,
          cookedKg: o.totalCookedKg,
          leftoverKg: o.unservedLeftoverKg,
          isStockout: o.isStockout,
          isAbnormal: o.isAbnormal,
        })),
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to load last closeout prefill data" };
  }
}

/**
 * Internal computation of closeout consumption variance vs recent eligible history
 * for the same kitchenId and mealType.
 */
export async function computeCloseoutVarianceInternal(
  kitchenId: string,
  mealId: string
): Promise<CloseoutVarianceSummary | null> {
  const meal = await prisma.meal.findUnique({
    where: { id: mealId },
    include: {
      observations: true,
    },
  });

  if (!meal || meal.kitchenId !== kitchenId) {
    return null;
  }

  const actualDiners =
    meal.observations.find((o) => o.actualDiners != null && o.actualDiners > 0)?.actualDiners ?? 0;
  const servedKg = calculateServedKg(meal.observations);

  // Retrieve prior meals for the exact same kitchenId and mealType (no cross-kitchen pooling)
  // strictly prior to this meal's service
  const candidatePriorMeals = await prisma.meal.findMany({
    where: {
      kitchenId,
      mealType: meal.mealType,
      id: { not: meal.id },
      OR: [
        { date: { lt: meal.date } },
        {
          date: meal.date,
          createdAt: { lt: meal.createdAt },
        },
      ],
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 20,
    include: {
      observations: true,
    },
  });

  const priorEligibleServices: HistoricalServiceInput[] = [];

  for (const candidate of candidatePriorMeals) {
    if (candidate.observations.length === 0) continue;

    const diners =
      candidate.observations.find((o) => o.actualDiners != null && o.actualDiners > 0)?.actualDiners ?? 0;
    if (diners <= 0) continue;

    // Check that observations are eligible (pure arithmetic, zero stockout/abnormal/excluded)
    const allEligible = candidate.observations.every((o) => isServiceObservationEligible(o));
    if (!allEligible) continue;

    const mServedKg = calculateServedKg(candidate.observations);
    if (mServedKg <= 0) continue;

    priorEligibleServices.push({
      id: candidate.id,
      date: candidate.date,
      actualDiners: diners,
      servedKg: mServedKg,
    });

    if (priorEligibleServices.length >= 5) break;
  }

  return calculateCloseoutVariance({ servedKg, actualDiners }, priorEligibleServices);
}

/**
 * Server Action: Retrieves explainable consumption variance summary vs recent eligible history
 * for the same kitchenId and mealType.
 *
 * Enforces requireKitchenAccess(kitchenId) for multi-tenant isolation.
 */
export async function getCloseoutVarianceSummary(
  kitchenId: string,
  mealIdOrParams: string | { mealId?: string; date?: string; mealType?: string }
): Promise<
  | { success: true; data: CloseoutVarianceSummary }
  | { success: false; error: string; statusCode?: number }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode ?? 403 };
  }

  try {
    let resolvedMealId: string | undefined;

    if (typeof mealIdOrParams === "string") {
      resolvedMealId = mealIdOrParams;
    } else if (mealIdOrParams.mealId) {
      resolvedMealId = mealIdOrParams.mealId;
    } else if (mealIdOrParams.date && mealIdOrParams.mealType) {
      const normalizedDate = normalizeServiceDate(mealIdOrParams.date);
      const foundMeal = await prisma.meal.findFirst({
        where: {
          kitchenId,
          date: normalizedDate,
          mealType: mealIdOrParams.mealType,
        },
        select: { id: true },
      });
      resolvedMealId = foundMeal?.id;
    }

    if (!resolvedMealId) {
      return {
        success: false,
        error: "Meal service not found for the specified date and service window",
        statusCode: 404,
      };
    }

    const targetMeal = await prisma.meal.findUnique({
      where: { id: resolvedMealId },
      select: { kitchenId: true },
    });

    if (!targetMeal) {
      return { success: false, error: "Meal service not found", statusCode: 404 };
    }

    if (targetMeal.kitchenId !== kitchenId) {
      return {
        success: false,
        error: "Forbidden: Meal service does not belong to this facility",
        statusCode: 403,
      };
    }

    const variance = await computeCloseoutVarianceInternal(kitchenId, resolvedMealId);
    if (!variance) {
      return {
        success: false,
        error: "Failed to compute closeout variance summary",
        statusCode: 500,
      };
    }

    return { success: true, data: variance };
  } catch (error) {
    console.error("Failed to compute closeout variance summary:", error);
    return {
      success: false,
      error: "Failed to compute closeout variance summary",
      statusCode: 500,
    };
  }
}


