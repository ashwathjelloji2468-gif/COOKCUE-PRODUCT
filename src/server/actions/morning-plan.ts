"use server";

import { prisma } from "@/lib/prisma";
import { computeRecommendation } from "@/lib/domain/recommendation";
import type { ObservationInput } from "@/lib/domain/recommendation";
import { requireKitchenAccess } from "@/lib/auth/session";
import { normalizeServiceDate } from "@/lib/domain/date";
import { safeRevalidatePath } from "@/lib/cache/revalidate";
import {
  type CookingPlanStatus,
  type CookingPlanDetail,
  PLAN_APPROVER_ROLES,
} from "./morning-plan-types";

export async function getOrCreateMeal(
  kitchenId: string,
  mealType: string,
  date: string
): Promise<{ success: true; mealId: string } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const mealDate = normalizeServiceDate(date);

    // Database-enforced atomic upsert guaranteeing service-level idempotency
    const meal = await prisma.meal.upsert({
      where: {
        kitchenId_mealType_date: {
          kitchenId,
          mealType,
          date: mealDate,
        },
      },
      update: {},
      create: {
        kitchenId,
        mealType,
        date: mealDate,
      },
    });

    return { success: true, mealId: meal.id };
  } catch (e) {
    return { success: false, error: "Failed to get or create meal" };
  }
}

export async function listDishesForKitchen(
  kitchenId: string
): Promise<{ success: true; data: { id: string; name: string; unit: string }[] } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const dishes = await prisma.dish.findMany({
      where: { kitchenId },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: dishes };
  } catch (e) {
    return { success: false, error: "Failed to list dishes" };
  }
}

export async function createDishForKitchen(
  kitchenId: string,
  name: string,
  unit: string = "kg"
): Promise<{ success: true; data: { id: string; name: string; unit: string } } | { success: false; error: string }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  if (!name || name.trim().length === 0) {
    return { success: false, error: "Dish name is required" };
  }

  try {
    const existing = await prisma.dish.findFirst({
      where: { kitchenId, name: { equals: name.trim(), mode: "insensitive" } },
    });
    if (existing) {
      return { success: false, error: "A dish with this name already exists in this kitchen" };
    }

    const dish = await prisma.dish.create({
      data: {
        kitchenId,
        name: name.trim(),
        unit: unit.trim() || "kg",
      },
    });

    return { success: true, data: { id: dish.id, name: dish.name, unit: dish.unit } };
  } catch (e) {
    return { success: false, error: "Failed to create dish" };
  }
}

export async function generatePlanRecommendations(
  kitchenId: string,
  mealId: string,
  mealType: string,
  expectedDiners: number,
  dishIds: string[]
): Promise<
  | {
      success: true;
      data: {
        dishId: string;
        dishName: string;
        recommendedKg: number | null;
        eligibleCount: number;
        exclusionReasons: string[];
        status: string;
        statusReason?: string;
        snapshotBasis?: any;
        allergenTags?: string[];
        menuCycleLabel?: string | null;
      }[];
    }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  if (expectedDiners < 0) {
    return { success: false, error: "Expected diners cannot be negative" };
  }

  try {
    const results = [];

    for (const dishId of dishIds) {
      const dish = await prisma.dish.findUnique({ where: { id: dishId } });
      if (!dish) continue;

      const observations = await prisma.observation.findMany({
        where: {
          kitchenId,
          dishId,
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
        { kitchenId, mealType, dishId, expectedDiners },
        { minimumEligibleObservations: 3 }
      );

      const snapshotBasis = {
        algorithmVersion: "1.0.0",
        formula: "sum(servedKg) / sum(actualDiners) * expectedDiners",
        threshold: { minimumEligibleObservations: 3 },
        applicableExpectedDiners: expectedDiners,
        matchingRules: { kitchenId, mealType, dishId },
        serviceIdentifiers: inputs.map((i) => i.serviceId),
        copiedHistoricalValues: inputs.map((i) => ({
          serviceId: i.serviceId,
          totalCookedKg: i.totalCookedKg,
          unservedLeftoverKg: i.unservedLeftoverKg,
          actualDiners: i.actualDiners,
          isStockout: i.isStockout,
          isAbnormal: i.isAbnormal,
          isExcluded: i.isExcluded,
          exclusionReason: i.exclusionReason,
        })),
        eligibleObservations: rec.eligibleCount,
        eligibleCount: rec.eligibleCount,
        excludedCount: rec.excludedCount,
        exclusionReasons: rec.exclusionReasons,
        totalServedKg: rec.totalServedKg,
        totalDiners: rec.totalDiners,
        servedPerDiner: rec.servedPerDiner,
        suggestedKg: rec.recommendedKg,
        calculatedAt: new Date().toISOString(),
      };

      results.push({
        dishId,
        dishName: dish.name,
        recommendedKg: rec.recommendedKg,
        eligibleCount: rec.eligibleCount,
        exclusionReasons: rec.exclusionReasons,
        status: rec.status,
        statusReason: rec.statusReason,
        snapshotBasis,
        allergenTags: dish.allergenTags || [],
        menuCycleLabel: dish.menuCycleLabel || null,
      });
    }

    return { success: true, data: results };
  } catch (e) {
    return { success: false, error: "Failed to generate recommendations" };
  }
}



export async function getCookingPlanForMeal(
  kitchenId: string,
  mealType: string,
  date: string
): Promise<
  | {
      success: true;
      data: CookingPlanDetail | null;
      mealId: string | null;
      canApprove?: boolean;
      currentUserRole?: string;
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
              orderBy: { dish: { name: "asc" } },
            },
            firstApprover: {
              select: { id: true, name: true, email: true, role: true },
            },
            secondApprover: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });

    const isAuthorizedApprover = PLAN_APPROVER_ROLES.includes(auth.user.role);

    if (!meal || !meal.cookingPlan) {
      return {
        success: true,
        data: null,
        mealId: meal ? meal.id : null,
        canApprove: isAuthorizedApprover,
        currentUserRole: auth.user.role,
      };
    }

    const plan = meal.cookingPlan;
    const isApproved = plan.approvalStatus === "APPROVED" || plan.status === "APPROVED";
    const status: CookingPlanStatus = isApproved ? "APPROVED" : "DRAFT";
    const approver = plan.firstApprover || plan.secondApprover;

    return {
      success: true,
      mealId: meal.id,
      data: {
        id: plan.id,
        kitchenId: plan.kitchenId,
        mealId: plan.mealId,
        expectedDiners: plan.expectedDiners,
        status,
        approvalStatus: status,
        approverId: plan.firstApproverId,
        approvedAt: plan.firstApprovedAt,
        approver,
        firstApproverId: plan.firstApproverId,
        firstApprovedAt: plan.firstApprovedAt,
        firstApprover: plan.firstApprover,
        secondApproverId: plan.secondApproverId,
        secondApprovedAt: plan.secondApprovedAt,
        secondApprover: plan.secondApprover,
        items: plan.items.map((i) => ({
          id: i.id,
          dishId: i.dishId,
          dishName: i.dish.name,
          recommendedKg: i.recommendedKg,
          approvedKg: i.approvedKg,
          snapshotBasisJson: i.snapshotBasisJson,
          allergenTags: i.dish.allergenTags || [],
          menuCycleLabel: i.dish.menuCycleLabel || null,
        })),
        currentUserId: auth.user.id,
        currentUserRole: auth.user.role,
        canApprove: isAuthorizedApprover,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to load cooking plan" };
  }
}

/**
 * Approve cooking plan by authorized Head Cook (or Founder).
 * Single approval transitions plan status directly to APPROVED.
 * Rejects KITCHEN_STAFF and other non-Head Cook roles.
 */
export async function approveCookingPlan(
  kitchenId: string,
  mealId: string,
  expectedDiners: number,
  items: {
    dishId: string;
    recommendedKg: number | null;
    approvedKg: number | null;
    snapshotBasis?: any;
  }[]
): Promise<
  | { success: true; planId: string; status: "APPROVED" }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  const isAuthorizedApprover = PLAN_APPROVER_ROLES.includes(auth.user.role);
  if (!isAuthorizedApprover) {
    return {
      success: false,
      error: "Unauthorized: Only Head Cooks (or Founder) can approve cooking plans.",
    };
  }

  const meal = await prisma.meal.findUnique({ where: { id: mealId } });
  if (!meal || meal.kitchenId !== kitchenId) {
    return {
      success: false,
      error: "Forbidden: Meal does not belong to this facility",
    };
  }

  const existingObs = await prisma.observation.findFirst({ where: { mealId } });
  if (existingObs) {
    return {
      success: false,
      error: "Cannot modify cooking plan: service closeout has already been recorded for this meal",
    };
  }

  try {
    const plan = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const cookingPlan = await tx.cookingPlan.upsert({
        where: { mealId },
        update: {
          expectedDiners,
          status: "APPROVED",
          approvalStatus: "APPROVED",
          firstApproverId: auth.user.id,
          firstApprovedAt: now,
          secondApproverId: null,
          secondApprovedAt: null,
        },
        create: {
          kitchenId,
          mealId,
          expectedDiners,
          status: "APPROVED",
          approvalStatus: "APPROVED",
          firstApproverId: auth.user.id,
          firstApprovedAt: now,
        },
      });

      for (const item of items) {
        const existingItem = await tx.planItem.findUnique({
          where: {
            planId_dishId: {
              planId: cookingPlan.id,
              dishId: item.dishId,
            },
          },
        });

        if (existingItem) {
          const isOverride =
            existingItem.approvedKg !== item.approvedKg && item.approvedKg !== null;

          if (isOverride) {
            await tx.planOverrideAudit.create({
              data: {
                planItemId: existingItem.id,
                recommendedKg: existingItem.recommendedKg,
                previousApprovedKg: existingItem.approvedKg,
                newApprovedKg: item.approvedKg,
                reason: "Head Cook approved quantity modified",
                approvedByUserId: auth.user.id,
              },
            });
          }

          await tx.planItem.update({
            where: { id: existingItem.id },
            data: {
              approvedKg: item.approvedKg,
              recommendedKg: existingItem.recommendedKg ?? item.recommendedKg,
              snapshotBasisJson:
                existingItem.snapshotBasisJson ??
                (item.snapshotBasis ? JSON.stringify(item.snapshotBasis) : null),
            },
          });
        } else {
          const created = await tx.planItem.create({
            data: {
              planId: cookingPlan.id,
              dishId: item.dishId,
              recommendedKg: item.recommendedKg,
              approvedKg: item.approvedKg,
              snapshotBasisJson: item.snapshotBasis ? JSON.stringify(item.snapshotBasis) : null,
            },
          });

          if (
            item.approvedKg !== null &&
            item.recommendedKg !== null &&
            item.approvedKg !== item.recommendedKg
          ) {
            await tx.planOverrideAudit.create({
              data: {
                planItemId: created.id,
                recommendedKg: item.recommendedKg,
                previousApprovedKg: item.recommendedKg,
                newApprovedKg: item.approvedKg,
                reason: "Head Cook initial approval override",
                approvedByUserId: auth.user.id,
              },
            });
          }
        }
      }

      return cookingPlan;
    });

    safeRevalidatePath(`/kitchen/${kitchenId}/morning`);
    safeRevalidatePath(`/kitchen/${kitchenId}/closeout`);

    return { success: true, planId: plan.id, status: "APPROVED" };
  } catch (e) {
    return { success: false, error: "Failed to approve cooking plan" };
  }
}

/**
 * If quantities change after approval, the plan reverts to DRAFT
 * and requires the Head Cook to approve again.
 */
export async function modifyCookingPlanQuantities(
  kitchenId: string,
  mealId: string,
  expectedDiners: number,
  items: {
    dishId: string;
    approvedKg: number | null;
  }[]
): Promise<
  | { success: true; planId: string; status: "DRAFT" }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  const existingObs = await prisma.observation.findFirst({ where: { mealId } });
  if (existingObs) {
    return {
      success: false,
      error: "Cannot modify cooking plan: service closeout has already been recorded for this meal",
    };
  }

  const existingPlan = await prisma.cookingPlan.findUnique({ where: { mealId } });
  if (!existingPlan) {
    return { success: false, error: "Cooking plan not found for this meal service." };
  }
  if (existingPlan.kitchenId !== kitchenId) {
    return {
      success: false,
      error: "Forbidden: Cooking plan does not belong to this facility",
    };
  }

  try {
    const updatedPlan = await prisma.$transaction(async (tx) => {
      // Revert status to DRAFT requiring Head Cook to re-approve
      const plan = await tx.cookingPlan.update({
        where: { mealId },
        data: {
          expectedDiners,
          status: "DRAFT",
          approvalStatus: "DRAFT",
          firstApproverId: null,
          firstApprovedAt: null,
          secondApproverId: null,
          secondApprovedAt: null,
        },
      });

      for (const item of items) {
        const existingItem = await tx.planItem.findUnique({
          where: {
            planId_dishId: {
              planId: plan.id,
              dishId: item.dishId,
            },
          },
        });

        if (existingItem) {
          if (existingItem.approvedKg !== item.approvedKg && item.approvedKg !== null) {
            await tx.planOverrideAudit.create({
              data: {
                planItemId: existingItem.id,
                recommendedKg: existingItem.recommendedKg,
                previousApprovedKg: existingItem.approvedKg,
                newApprovedKg: item.approvedKg,
                reason: "Quantities revised after approval (reverted to draft)",
                approvedByUserId: auth.user.id,
              },
            });
          }

          await tx.planItem.update({
            where: { id: existingItem.id },
            data: { approvedKg: item.approvedKg },
          });
        }
      }

      return plan;
    });

    safeRevalidatePath(`/kitchen/${kitchenId}/morning`);
    safeRevalidatePath(`/kitchen/${kitchenId}/closeout`);

    return { success: true, planId: updatedPlan.id, status: "DRAFT" };
  } catch (e) {
    return { success: false, error: "Failed to revise cooking plan quantities" };
  }
}

/**
 * Contractor / Manager action: Submit or save a draft plan to Head Cook for authorization
 */
export async function submitDraftPlanToHeadCook(
  kitchenId: string,
  mealId: string,
  expectedDiners: number,
  items: {
    dishId: string;
    recommendedKg: number | null;
    approvedKg: number | null;
    snapshotBasis?: any;
  }[]
): Promise<
  | { success: true; planId: string; status: "DRAFT"; message: string }
  | { success: false; error: string }
> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) return { success: false, error: auth.error };

  const meal = await prisma.meal.findUnique({ where: { id: mealId } });
  if (!meal || meal.kitchenId !== kitchenId) {
    return {
      success: false,
      error: "Forbidden: Meal does not belong to this facility",
    };
  }

  const existingObs = await prisma.observation.findFirst({ where: { mealId } });
  if (existingObs) {
    return {
      success: false,
      error: "Cannot modify cooking plan: service closeout has already been recorded for this meal",
    };
  }

  try {
    const plan = await prisma.$transaction(async (tx) => {
      const cookingPlan = await tx.cookingPlan.upsert({
        where: { mealId },
        update: {
          expectedDiners,
          status: "DRAFT",
          approvalStatus: "DRAFT",
          firstApproverId: null,
          firstApprovedAt: null,
          secondApproverId: null,
          secondApprovedAt: null,
        },
        create: {
          kitchenId,
          mealId,
          expectedDiners,
          status: "DRAFT",
          approvalStatus: "DRAFT",
        },
      });

      for (const item of items) {
        const existingItem = await tx.planItem.findUnique({
          where: {
            planId_dishId: {
              planId: cookingPlan.id,
              dishId: item.dishId,
            },
          },
        });

        if (existingItem) {
          await tx.planItem.update({
            where: { id: existingItem.id },
            data: {
              approvedKg: item.approvedKg,
              recommendedKg: existingItem.recommendedKg ?? item.recommendedKg,
              snapshotBasisJson:
                existingItem.snapshotBasisJson ??
                (item.snapshotBasis ? JSON.stringify(item.snapshotBasis) : null),
            },
          });
        } else {
          await tx.planItem.create({
            data: {
              planId: cookingPlan.id,
              dishId: item.dishId,
              recommendedKg: item.recommendedKg,
              approvedKg: item.approvedKg,
              snapshotBasisJson: item.snapshotBasis
                ? JSON.stringify(item.snapshotBasis)
                : null,
            },
          });
        }
      }

      return cookingPlan;
    });

    safeRevalidatePath(`/kitchen/${kitchenId}/morning`);
    safeRevalidatePath(`/kitchen/${kitchenId}/closeout`);

    return {
      success: true,
      planId: plan.id,
      status: "DRAFT",
      message: "Draft plan successfully submitted to Head Cook for review and approval.",
    };
  } catch (err: any) {
    return { success: false, error: "Failed to submit draft cooking plan" };
  }
}

/**
 * Backward compatibility aliases
 */
export async function submitFirstApproval(
  kitchenId: string,
  mealId: string,
  expectedDiners: number,
  items: {
    dishId: string;
    recommendedKg: number | null;
    approvedKg: number | null;
    snapshotBasis?: any;
  }[]
): Promise<
  | { success: true; planId: string; status: "APPROVED" }
  | { success: false; error: string }
> {
  return approveCookingPlan(kitchenId, mealId, expectedDiners, items);
}

export async function saveCookingPlan(
  kitchenId: string,
  mealId: string,
  expectedDiners: number,
  items: {
    dishId: string;
    recommendedKg: number | null;
    approvedKg: number | null;
    snapshotBasis?: any;
  }[]
): Promise<{ success: true; planId: string } | { success: false; error: string }> {
  return submitDraftPlanToHeadCook(kitchenId, mealId, expectedDiners, items);
}

export type RecommendationExplanation = {
  kitchenId: string;
  dishId: string;
  dishName: string;
  unit: string;
  mealType: string;
  expectedDiners: number;
  hasEnoughHistory: boolean;
  status: string;
  statusReason?: string;
  message: string;
  suggestedKg: number | null;
  servedPerDinerRate: number | null;
  totalServedKg: number | null;
  totalDiners: number | null;
  minimumRequired: number;
  eligibleCount: number;
  excludedCount: number;
  totalHistoricalObservations: number;
  cappedListNotice?: string;
  eligibleObservations: {
    mealId: string;
    date: string;
    cookedKg: number;
    leftoverKg: number;
    servedKg: number;
    actualDiners: number;
    servedPerDiner: number;
    notes?: string | null;
  }[];
  exclusionSummary?: {
    stockoutCount: number;
    abnormalCount: number;
    otherExcludedCount: number;
  };
};

/**
 * Wave 2 / T2-D: "Why this kg?" explain panel backend.
 * Provides transparent, pure-arithmetic audit breakdown of eligible historical services used to compute recommended kg.
 * Reuses pure computeRecommendation rules without altering formulas.
 */
export async function getRecommendationExplanation(
  kitchenId: string,
  dishId: string,
  mealType: string,
  expectedDiners: number
): Promise<{ success: true; data: RecommendationExplanation } | { success: false; error: string; statusCode?: number }> {
  const auth = await requireKitchenAccess(kitchenId);
  if (!auth.success) {
    return { success: false, error: auth.error, statusCode: auth.statusCode };
  }

  const effectiveMealType = (mealType || "LUNCH").toUpperCase();

  try {
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { id: true, name: true, unit: true, kitchenId: true },
    });

    if (!dish || dish.kitchenId !== kitchenId) {
      return { success: false, error: "Dish not found in this kitchen facility", statusCode: 404 };
    }

    // Historical observations matching exact facility, dish, and meal type
    const observations = await prisma.observation.findMany({
      where: {
        kitchenId,
        dishId,
        meal: { mealType: effectiveMealType },
      },
      include: {
        meal: true,
      },
      orderBy: {
        meal: { date: "desc" },
      },
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

    // Invoke pure domain engine with exact same rules and thresholds
    const rec = computeRecommendation(
      inputs,
      { kitchenId, mealType: effectiveMealType, dishId, expectedDiners },
      { minimumEligibleObservations: 3 }
    );

    // Identify duplicate serviceIds to replicate exact computeRecommendation filtering
    const serviceCounts = new Map<string, number>();
    for (const obs of inputs) {
      if (typeof obs.serviceId === "string" && obs.serviceId.trim().length > 0) {
        const sid = obs.serviceId.trim();
        serviceCounts.set(sid, (serviceCounts.get(sid) ?? 0) + 1);
      }
    }

    // Filter eligible observations matching domain rules
    const eligibleObsList: RecommendationExplanation["eligibleObservations"] = [];
    let stockoutCount = 0;
    let abnormalCount = 0;
    let otherExcludedCount = 0;

    for (const o of observations) {
      if (o.isStockout) stockoutCount++;
      else if (o.isAbnormal) abnormalCount++;

      const isEligible =
        !o.isStockout &&
        !o.isAbnormal &&
        !o.isExcluded &&
        o.eligibilityStatus !== "EXCLUDED" &&
        o.eligibilityStatus !== "INCOMPLETE" &&
        o.eligibilityStatus !== "NEEDS_REVIEW" &&
        o.totalCookedKg !== null &&
        Number.isFinite(o.totalCookedKg) &&
        o.totalCookedKg >= 0 &&
        o.unservedLeftoverKg !== null &&
        Number.isFinite(o.unservedLeftoverKg) &&
        o.unservedLeftoverKg >= 0 &&
        o.unservedLeftoverKg <= o.totalCookedKg &&
        o.actualDiners !== null &&
        Number.isFinite(o.actualDiners) &&
        Number.isSafeInteger(o.actualDiners) &&
        o.actualDiners > 0 &&
        (serviceCounts.get(o.mealId) ?? 0) <= 1;

      if (isEligible) {
        const cooked = o.totalCookedKg!;
        const leftover = o.unservedLeftoverKg!;
        const served = cooked - leftover;
        const diners = o.actualDiners!;
        const rate = diners > 0 ? served / diners : 0;
        const dateStr = o.meal.date ? o.meal.date.toISOString().slice(0, 10) : "";

        eligibleObsList.push({
          mealId: o.mealId,
          date: dateStr,
          cookedKg: Number(cooked.toFixed(2)),
          leftoverKg: Number(leftover.toFixed(2)),
          servedKg: Number(served.toFixed(2)),
          actualDiners: diners,
          servedPerDiner: Number(rate.toFixed(4)),
          notes: o.exclusionReason || null,
        });
      } else {
        if (!o.isStockout && !o.isAbnormal) {
          otherExcludedCount++;
        }
      }
    }

    // Cap at most recent 10 eligible observations
    const cappedList = eligibleObsList.slice(0, 10);
    const cappedListNotice =
      eligibleObsList.length > 10
        ? `Showing most recent 10 of ${eligibleObsList.length} eligible historical services`
        : undefined;

    const hasEnoughHistory = rec.status === "OK" && rec.recommendedKg !== null;

    let message = "";
    if (hasEnoughHistory) {
      message = `Suggested ${rec.recommendedKg?.toFixed(2)} ${dish.unit || "kg"} calculated from ${rec.eligibleCount} eligible historical services (${rec.servedPerDiner?.toFixed(4)} ${dish.unit || "kg"}/diner × ${expectedDiners} people expected). Pure arithmetic only — no ML formulas.`;
    } else if (rec.status === "INSUFFICIENT_HISTORY") {
      const needed = Math.max(0, 3 - rec.eligibleCount);
      message = `No numerical suggestion — need at least 3 eligible services. Currently have ${rec.eligibleCount} (need ${needed} more).`;
    } else {
      message = rec.statusReason || "Recommendation unavailable.";
    }

    return {
      success: true,
      data: {
        kitchenId,
        dishId,
        dishName: dish.name,
        unit: dish.unit || "kg",
        mealType: effectiveMealType,
        expectedDiners,
        hasEnoughHistory,
        status: rec.status,
        statusReason: rec.statusReason,
        message,
        suggestedKg: rec.recommendedKg,
        servedPerDinerRate: rec.servedPerDiner,
        totalServedKg: rec.totalServedKg,
        totalDiners: rec.totalDiners,
        minimumRequired: 3,
        eligibleCount: rec.eligibleCount,
        excludedCount: rec.excludedCount,
        totalHistoricalObservations: observations.length,
        cappedListNotice,
        eligibleObservations: cappedList,
        exclusionSummary: {
          stockoutCount,
          abnormalCount,
          otherExcludedCount,
        },
      },
    };
  } catch (err) {
    console.error("Failed to get recommendation explanation:", err);
    return { success: false, error: "Failed to generate recommendation explanation", statusCode: 500 };
  }
}
