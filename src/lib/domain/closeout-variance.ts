/**
 * CookCue Closeout Variance Calculation
 * Pure arithmetic domain rules for comparing a meal's consumption
 * against recent eligible historical services of the same kitchen and mealType.
 *
 * FORMULA:
 * 1. thisServiceKgPerDiner = sum(estimated served kg) / actualDiners
 *    where estimated served kg = max(0, cooked - leftover) per dish (skipping invalid/negative rows)
 * 2. baselineKgPerDiner = total served kg across last up to 5 prior eligible services /
 *                         total diners across those same services
 * 3. variancePct = ((thisServiceKgPerDiner - baselineKgPerDiner) / baselineKgPerDiner) * 100
 *
 * RULES:
 * - Pure arithmetic only; no ML, no safety buffers.
 * - Minimum 3 prior eligible services required for comparison; otherwise "Not enough eligible history to compare yet".
 * - Prior services must belong to the exact same kitchenId and mealType (no cross-kitchen pooling).
 * - Only ELIGIBLE observations qualify (not stockout, not abnormal, not excluded, not incomplete).
 * - Safe division by zero handling everywhere.
 */

export type CloseoutVarianceSummary = {
  hasEnoughHistory: boolean;
  message?: string;
  priorServicesCount: number;
  thisServiceKgPerDiner?: number;
  baselineKgPerDiner?: number;
  variancePct?: number;
  varianceLabel?: "higher" | "lower" | "similar";
  varianceText?: string;
};

export type ObservationInput = {
  totalCookedKg: number | null;
  unservedLeftoverKg: number | null;
  actualDiners?: number | null;
  isStockout?: boolean;
  isAbnormal?: boolean;
  isExcluded?: boolean;
  eligibilityStatus?: string;
};

export type HistoricalServiceInput = {
  id: string;
  date: Date | string;
  actualDiners: number;
  servedKg: number;
};

/**
 * Calculates served kg for a set of observations:
 * sum(cooked - leftover) for non-null, valid rows where leftover <= cooked.
 */
export function calculateServedKg(observations: ObservationInput[]): number {
  let totalServed = 0;
  for (const obs of observations) {
    if (
      obs.totalCookedKg !== null &&
      obs.unservedLeftoverKg !== null &&
      Number.isFinite(obs.totalCookedKg) &&
      Number.isFinite(obs.unservedLeftoverKg) &&
      obs.totalCookedKg >= 0 &&
      obs.unservedLeftoverKg >= 0 &&
      obs.unservedLeftoverKg <= obs.totalCookedKg
    ) {
      totalServed += obs.totalCookedKg - obs.unservedLeftoverKg;
    }
  }
  return totalServed;
}

/**
 * Determines if a prior service's observations qualify as clean learning baseline.
 * Must have > 0 diners, at least 1 observation, and zero stockouts, abnormal flags,
 * or exclusions.
 */
export function isServiceObservationEligible(obs: ObservationInput): boolean {
  if (obs.isStockout || obs.isAbnormal || obs.isExcluded) {
    return false;
  }
  if (obs.eligibilityStatus && obs.eligibilityStatus !== "ELIGIBLE") {
    return false;
  }
  if (
    obs.totalCookedKg === null ||
    obs.unservedLeftoverKg === null ||
    !Number.isFinite(obs.totalCookedKg) ||
    !Number.isFinite(obs.unservedLeftoverKg) ||
    obs.totalCookedKg < 0 ||
    obs.unservedLeftoverKg < 0 ||
    obs.unservedLeftoverKg > obs.totalCookedKg
  ) {
    return false;
  }
  return true;
}

/**
 * Computes the variance summary from this service and prior eligible services.
 */
export function calculateCloseoutVariance(
  thisService: {
    servedKg: number;
    actualDiners: number;
  },
  priorServices: HistoricalServiceInput[]
): CloseoutVarianceSummary {
  // If this service has invalid diner count or 0 diners, cannot calculate per-diner metric
  if (!thisService.actualDiners || thisService.actualDiners <= 0 || !Number.isSafeInteger(thisService.actualDiners)) {
    return {
      hasEnoughHistory: false,
      priorServicesCount: priorServices.length,
      message: "Actual diners must be a positive integer to compute consumption variance.",
    };
  }

  // Filter and take up to 5 most recent prior eligible services
  const recentEligible = priorServices
    .filter((s) => s.actualDiners > 0 && s.servedKg >= 0)
    .slice(0, 5);

  const priorCount = recentEligible.length;

  // Strict rule: at least 3 prior eligible services required
  if (priorCount < 3) {
    return {
      hasEnoughHistory: false,
      priorServicesCount: priorCount,
      message: "Not enough eligible history to compare yet",
    };
  }

  const thisServiceKgPerDiner = thisService.servedKg / thisService.actualDiners;

  const totalPriorServed = recentEligible.reduce((acc, s) => acc + s.servedKg, 0);
  const totalPriorDiners = recentEligible.reduce((acc, s) => acc + s.actualDiners, 0);

  if (totalPriorDiners <= 0 || totalPriorServed <= 0) {
    return {
      hasEnoughHistory: false,
      priorServicesCount: priorCount,
      message: "Not enough eligible history to compare yet",
    };
  }

  const baselineKgPerDiner = totalPriorServed / totalPriorDiners;

  if (baselineKgPerDiner <= 0) {
    return {
      hasEnoughHistory: false,
      priorServicesCount: priorCount,
      message: "Not enough eligible history to compare yet",
    };
  }

  const rawVariancePct = ((thisServiceKgPerDiner - baselineKgPerDiner) / baselineKgPerDiner) * 100;
  const variancePct = Math.round(rawVariancePct * 10) / 10;

  let varianceLabel: "higher" | "lower" | "similar";
  let varianceText: string;

  if (Math.abs(variancePct) < 2.0) {
    varianceLabel = "similar";
    const sign = variancePct > 0 ? "+" : "";
    varianceText = `${sign}${variancePct.toFixed(1)}% · similar to recent eligible average`;
  } else if (variancePct >= 2.0) {
    varianceLabel = "higher";
    varianceText = `+${variancePct.toFixed(1)}% higher than recent eligible average`;
  } else {
    varianceLabel = "lower";
    varianceText = `${variancePct.toFixed(1)}% lower than recent eligible average`;
  }

  return {
    hasEnoughHistory: true,
    priorServicesCount: priorCount,
    thisServiceKgPerDiner: Math.round(thisServiceKgPerDiner * 1000) / 1000,
    baselineKgPerDiner: Math.round(baselineKgPerDiner * 1000) / 1000,
    variancePct,
    varianceLabel,
    varianceText,
  };
}
