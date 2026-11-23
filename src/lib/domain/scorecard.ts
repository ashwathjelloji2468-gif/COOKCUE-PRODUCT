/**
 * Domain types and pure metric calculation for the Contractor Weekly Scorecard.
 * Operational discipline metrics from real data to spotlight kitchens needing attention.
 * No recommendation math or business rules changed.
 */

import { toServiceDateString } from "./date";

export type KitchenWeeklyScorecard = {
  kitchenId: string;
  name: string;
  location?: string | null;
  status: string;
  /** Meals with APPROVED plan that also have closeout observations / meals with APPROVED plan in the week (null if denominator 0) */
  closeoutCompliancePct: number | null;
  /** Meals with APPROVED plan in the week */
  approvedPlansCount: number;
  /** Approved plans in the week that have at least one closeout observation submitted */
  approvedWithCloseoutCount: number;
  /** Count of meals in the week with APPROVED plan */
  plansApprovedOnTimeCount: number;
  /** Count of meals in the week with DRAFT or missing plan */
  plansDraftOrMissingCount: number;
  /** Distinct dates with any isStockout observation in the week */
  stockoutDays: number;
  /** Count of eligible observations in the week */
  eligibleObservationCount: number;
  /** Count of open operational exceptions detected for this kitchen */
  openExceptionsCount: number;
};

export type ContractorWeeklyScorecard = {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  contractor: {
    id: string;
    code?: string | null;
    name: string;
  };
  kitchens: KitchenWeeklyScorecard[];
};

export type RawMealForScorecard = {
  id: string;
  kitchenId: string;
  date: Date;
  cookingPlan?: {
    id: string;
    status: string;
    approvalStatus?: string | null;
  } | null;
  observations: {
    id: string;
    isStockout: boolean;
    isAbnormal: boolean;
    isExcluded: boolean;
    totalCookedKg: number | null;
    unservedLeftoverKg: number | null;
    actualDiners: number | null;
    eligibilityStatus?: string | null;
  }[];
};

/**
 * Checks whether an observation is eligible for baseline learning.
 * Reuses the canonical product definition:
 * Not stockout, not abnormal, not excluded, valid cooked & leftover weights, positive diners, leftover <= cooked.
 */
export function isObservationEligible(obs: {
  isStockout: boolean;
  isAbnormal: boolean;
  isExcluded: boolean;
  totalCookedKg: number | null;
  unservedLeftoverKg: number | null;
  actualDiners: number | null;
  eligibilityStatus?: string | null;
}): boolean {
  if (obs.eligibilityStatus) {
    return obs.eligibilityStatus === "ELIGIBLE";
  }
  return (
    !obs.isStockout &&
    !obs.isAbnormal &&
    !obs.isExcluded &&
    obs.totalCookedKg !== null &&
    obs.unservedLeftoverKg !== null &&
    obs.actualDiners !== null &&
    obs.actualDiners > 0 &&
    obs.unservedLeftoverKg <= obs.totalCookedKg
  );
}

/**
 * Calculates weekly discipline metrics for a single kitchen given its raw meals in the week window.
 */
export function computeKitchenWeeklyMetrics(params: {
  kitchen: {
    id: string;
    name: string;
    location?: string | null;
    status: string;
  };
  meals: RawMealForScorecard[];
  openExceptionsCount?: number;
}): KitchenWeeklyScorecard {
  const { kitchen, meals, openExceptionsCount = 0 } = params;

  let approvedPlansCount = 0;
  let approvedWithCloseoutCount = 0;
  let plansDraftOrMissingCount = 0;
  let eligibleObservationCount = 0;
  const stockoutDates = new Set<string>();

  for (const meal of meals) {
    const isApproved =
      meal.cookingPlan &&
      (meal.cookingPlan.status === "APPROVED" || meal.cookingPlan.approvalStatus === "APPROVED");

    if (isApproved) {
      approvedPlansCount++;
      if (meal.observations.length > 0) {
        approvedWithCloseoutCount++;
      }
    } else {
      plansDraftOrMissingCount++;
    }

    const mealDateStr = toServiceDateString(meal.date);

    for (const obs of meal.observations) {
      if (obs.isStockout) {
        stockoutDates.add(mealDateStr);
      }
      if (isObservationEligible(obs)) {
        eligibleObservationCount++;
      }
    }
  }

  const closeoutCompliancePct =
    approvedPlansCount > 0
      ? Math.round((approvedWithCloseoutCount / approvedPlansCount) * 1000) / 10
      : null;

  return {
    kitchenId: kitchen.id,
    name: kitchen.name,
    location: kitchen.location ?? null,
    status: kitchen.status,
    closeoutCompliancePct,
    approvedPlansCount,
    approvedWithCloseoutCount,
    plansApprovedOnTimeCount: approvedPlansCount,
    plansDraftOrMissingCount,
    stockoutDays: stockoutDates.size,
    eligibleObservationCount,
    openExceptionsCount,
  };
}

/**
 * Sorts kitchen scorecards:
 * Priority 1: Worst closeoutCompliance first (lowest percentage).
 *             Kitchens with draft/missing plans and 0 approved plans also rank before healthy kitchens.
 * Priority 2: Most stockouts first (descending stockoutDays).
 * Priority 3: Most open exceptions first (descending openExceptionsCount).
 * Priority 4: Alphabetical by kitchen name.
 */
export function sortKitchenScorecards(
  kitchens: KitchenWeeklyScorecard[]
): KitchenWeeklyScorecard[] {
  return [...kitchens].sort((a, b) => {
    // Determine sort rank for compliance:
    // 0% -> 0.00 (worst)
    // 50% -> 50.00
    // null with unapproved/draft plans -> 0.01 (severe unapproved backlog)
    // 100% -> 100.00 (perfect)
    // null with 0 meals -> 100.01 (idle/no operational meals)
    const getSortScore = (k: KitchenWeeklyScorecard): number => {
      if (k.closeoutCompliancePct !== null) {
        return k.closeoutCompliancePct;
      }
      return k.plansDraftOrMissingCount > 0 ? 0.01 : 100.01;
    };

    const scoreA = getSortScore(a);
    const scoreB = getSortScore(b);

    if (scoreA !== scoreB) {
      return scoreA - scoreB; // Lower score (worse compliance) first
    }

    // Tie-breaker: Most stockouts first
    if (b.stockoutDays !== a.stockoutDays) {
      return b.stockoutDays - a.stockoutDays;
    }

    // Secondary tie-breaker: Most open exceptions first
    if (b.openExceptionsCount !== a.openExceptionsCount) {
      return b.openExceptionsCount - a.openExceptionsCount;
    }

    return a.name.localeCompare(b.name);
  });
}
