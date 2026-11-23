import Decimal from "decimal.js-light";

/**
 * Isolated Decimal constructor configured for domain arithmetic.
 *
 * Requirements & Documentation:
 * 1. Precision: Configured to 20 significant digits to eliminate binary floating-point drift.
 * 2. Intermediate Operations: In decimal.js-light, arithmetic results are truncated to the configured
 *    precision. Rounding modes (such as ROUND_HALF_UP) do not control intermediate arithmetic operations
 *    in this lightweight library.
 * 3. Intermediate Quantization: No arbitrary quantization (e.g. 3-decimal rounding) is applied to intermediate values.
 * 4. Existing Float Data: Converting existing PostgreSQL Float values to Decimal cannot recover precision
 *    lost when values were originally stored or parsed as IEEE 754 floats. However, it prevents any further
 *    floating-point degradation during summation, subtraction, division, and multiplication.
 */
export const DomainDecimal = Decimal.clone({
  precision: 20,
  toExpNeg: -7,
  toExpPos: 21,
});

export type ObservationInput = {
  serviceId: string;
  kitchenId: string;
  mealType: string;
  dishId: string;
  totalCookedKg: number | null;
  unservedLeftoverKg: number | null;
  actualDiners: number | null;
  isStockout: boolean;
  isAbnormal: boolean;
  isExcluded: boolean;
  exclusionReason?: string | null;
  eligibilityStatus?: string | null;
};

export type RecommendationConfig = {
  minimumEligibleObservations?: number;
};

export type ExclusionReason =
  | "STOCKOUT"
  | "ABNORMAL"
  | "EXCLUDED"
  | "MISSING_SERVICE_ID"
  | "DUPLICATE_SERVICE"
  | "MISSING_COOKED"
  | "MISSING_LEFTOVER"
  | "MISSING_DINERS"
  | "INVALID_QUANTITY"
  | "INVALID_DINERS"
  | "LEFTOVER_EXCEEDS_PRODUCTION"
  | "ZERO_DINERS"
  | "DIFFERENT_KITCHEN"
  | "DIFFERENT_MEAL_TYPE"
  | "DIFFERENT_DISH";

export type RecommendationStatus =
  | "OK"
  | "INSUFFICIENT_HISTORY"
  | "INVALID_TARGET"
  | "INVALID_CONFIG";

export type RecommendationResult = {
  status: RecommendationStatus;
  statusReason?: string;
  recommendedKg: number | null;
  eligibleCount: number;
  excludedCount: number;
  exclusionReasons: ExclusionReason[];
  totalServedKg: number | null;
  totalDiners: number | null;
  servedPerDiner: number | null;
  baselineRecommendedKg: number | null;
};

function isMissing(value: unknown): boolean {
  return value === null || value === undefined;
}

export function computeRecommendation(
  observations: ObservationInput[],
  target: { kitchenId: string; mealType: string; dishId: string; expectedDiners?: number },
  config?: RecommendationConfig
): RecommendationResult {
  // 1. Validate Configuration
  let minimumEligibleObservations = 3;
  if (config !== undefined && config.minimumEligibleObservations !== undefined) {
    const min = config.minimumEligibleObservations;
    if (typeof min !== "number" || !Number.isSafeInteger(min) || min <= 0) {
      return {
        status: "INVALID_CONFIG",
        statusReason: "Minimum eligible observations must be a positive safe integer",
        recommendedKg: null,
        eligibleCount: 0,
        excludedCount: observations.length,
        exclusionReasons: [],
        totalServedKg: null,
        totalDiners: null,
        servedPerDiner: null,
        baselineRecommendedKg: null,
      };
    }
    minimumEligibleObservations = min;
  }

  // 2. Validate Target Expected Diners
  let isTargetValid = true;
  let targetErrorReason: string | undefined;

  if (
    isMissing(target.expectedDiners) ||
    typeof target.expectedDiners !== "number" ||
    !Number.isFinite(target.expectedDiners) ||
    !Number.isSafeInteger(target.expectedDiners) ||
    target.expectedDiners <= 0
  ) {
    isTargetValid = false;
    if (target.expectedDiners === 0) {
      targetErrorReason = "Expected diners must be greater than zero";
    } else {
      targetErrorReason = "Expected diners must be a positive safe integer";
    }
  }

  // 3. Pre-scan for Duplicate Services matching target scope
  const serviceCounts = new Map<string, number>();
  for (const obs of observations) {
    if (
      obs.kitchenId === target.kitchenId &&
      obs.mealType === target.mealType &&
      obs.dishId === target.dishId &&
      typeof obs.serviceId === "string" &&
      obs.serviceId.trim().length > 0
    ) {
      const sid = obs.serviceId.trim();
      serviceCounts.set(sid, (serviceCounts.get(sid) ?? 0) + 1);
    }
  }

  const exclusionReasons: ExclusionReason[] = [];
  const eligible: ObservationInput[] = [];

  // 4. Observation Eligibility Filtering
  for (const obs of observations) {
    // Missing service ID check
    if (
      isMissing(obs.serviceId) ||
      typeof obs.serviceId !== "string" ||
      obs.serviceId.trim().length === 0
    ) {
      exclusionReasons.push("MISSING_SERVICE_ID");
      continue;
    }

    // Scope matching
    if (obs.kitchenId !== target.kitchenId) {
      exclusionReasons.push("DIFFERENT_KITCHEN");
      continue;
    }
    if (obs.mealType !== target.mealType) {
      exclusionReasons.push("DIFFERENT_MEAL_TYPE");
      continue;
    }
    if (obs.dishId !== target.dishId) {
      exclusionReasons.push("DIFFERENT_DISH");
      continue;
    }

    // Duplicate service detection (fail-closed: exclude all in duplicate group)
    const sid = obs.serviceId.trim();
    if ((serviceCounts.get(sid) ?? 0) > 1) {
      exclusionReasons.push("DUPLICATE_SERVICE");
      continue;
    }

    // Explicit non-eligible status check (prefers filtering ELIGIBLE when status is present, keeps behavioral compatibility)
    if (
      obs.eligibilityStatus === "EXCLUDED" ||
      obs.eligibilityStatus === "INCOMPLETE" ||
      obs.eligibilityStatus === "NEEDS_REVIEW"
    ) {
      if (obs.isStockout) {
        exclusionReasons.push("STOCKOUT");
      } else if (obs.isAbnormal) {
        exclusionReasons.push("ABNORMAL");
      } else if (isMissing(obs.totalCookedKg)) {
        exclusionReasons.push("MISSING_COOKED");
      } else if (isMissing(obs.unservedLeftoverKg)) {
        exclusionReasons.push("MISSING_LEFTOVER");
      } else if (isMissing(obs.actualDiners)) {
        exclusionReasons.push("MISSING_DINERS");
      } else {
        exclusionReasons.push("EXCLUDED");
      }
      continue;
    }

    // Operational and manual exclusions
    if (obs.isStockout) {
      exclusionReasons.push("STOCKOUT");
      continue;
    }
    if (obs.isAbnormal) {
      exclusionReasons.push("ABNORMAL");
      continue;
    }
    if (obs.isExcluded) {
      exclusionReasons.push("EXCLUDED");
      continue;
    }

    // Missing values
    if (isMissing(obs.totalCookedKg)) {
      exclusionReasons.push("MISSING_COOKED");
      continue;
    }
    if (isMissing(obs.unservedLeftoverKg)) {
      exclusionReasons.push("MISSING_LEFTOVER");
      continue;
    }
    if (isMissing(obs.actualDiners)) {
      exclusionReasons.push("MISSING_DINERS");
      continue;
    }

    // Numeric and finite validation for quantities
    if (
      typeof obs.totalCookedKg !== "number" ||
      !Number.isFinite(obs.totalCookedKg) ||
      obs.totalCookedKg < 0 ||
      typeof obs.unservedLeftoverKg !== "number" ||
      !Number.isFinite(obs.unservedLeftoverKg) ||
      obs.unservedLeftoverKg < 0
    ) {
      exclusionReasons.push("INVALID_QUANTITY");
      continue;
    }

    // Leftovers exceeding production
    if (obs.unservedLeftoverKg > obs.totalCookedKg) {
      exclusionReasons.push("LEFTOVER_EXCEEDS_PRODUCTION");
      continue;
    }

    // Diners validation
    if (typeof obs.actualDiners !== "number" || !Number.isFinite(obs.actualDiners)) {
      exclusionReasons.push("INVALID_DINERS");
      continue;
    }
    if (obs.actualDiners === 0) {
      exclusionReasons.push("ZERO_DINERS");
      continue;
    }
    if (!Number.isSafeInteger(obs.actualDiners) || obs.actualDiners < 0) {
      exclusionReasons.push("INVALID_DINERS");
      continue;
    }

    eligible.push(obs);
  }

  const eligibleCount = eligible.length;
  const excludedCount = observations.length - eligibleCount;

  // 5. Evaluate History Sufficiency
  if (eligibleCount < minimumEligibleObservations) {
    return {
      status: isTargetValid ? "INSUFFICIENT_HISTORY" : "INVALID_TARGET",
      statusReason: isTargetValid
        ? `Requires at least ${minimumEligibleObservations} eligible services, found ${eligibleCount}`
        : targetErrorReason,
      recommendedKg: null,
      eligibleCount,
      excludedCount,
      exclusionReasons,
      totalServedKg: null,
      totalDiners: null,
      servedPerDiner: null,
      baselineRecommendedKg: null,
    };
  }

  // 6. Aggregate Served Quantities & Diners using Isolated DomainDecimal
  let totalServedKgDec = new DomainDecimal(0);
  let totalDinersDec = new DomainDecimal(0);

  for (const obs of eligible) {
    try {
      const cookedDec = new DomainDecimal(obs.totalCookedKg!);
      const leftoverDec = new DomainDecimal(obs.unservedLeftoverKg!);
      const servedDec = cookedDec.minus(leftoverDec);
      const dinersDec = new DomainDecimal(obs.actualDiners!);

      totalServedKgDec = totalServedKgDec.plus(servedDec);
      totalDinersDec = totalDinersDec.plus(dinersDec);
    } catch {
      return {
        status: "INVALID_TARGET",
        statusReason: "Arithmetic evaluation failed due to invalid numeric input",
        recommendedKg: null,
        eligibleCount,
        excludedCount,
        exclusionReasons,
        totalServedKg: null,
        totalDiners: null,
        servedPerDiner: null,
        baselineRecommendedKg: null,
      };
    }
  }

  if (totalDinersDec.isZero() || totalDinersDec.isNegative()) {
    return {
      status: "INSUFFICIENT_HISTORY",
      statusReason: "Total actual diners across eligible services is zero",
      recommendedKg: null,
      eligibleCount,
      excludedCount,
      exclusionReasons,
      totalServedKg: totalServedKgDec.toNumber(),
      totalDiners: 0,
      servedPerDiner: null,
      baselineRecommendedKg: null,
    };
  }

  const servedPerDinerDec = totalServedKgDec.dividedBy(totalDinersDec);

  const totalServedKgNum = totalServedKgDec.toNumber();
  const totalDinersNum = totalDinersDec.toNumber();
  const servedPerDinerNum = servedPerDinerDec.toNumber();

  if (
    !Number.isFinite(totalServedKgNum) ||
    !Number.isFinite(totalDinersNum) ||
    !Number.isFinite(servedPerDinerNum)
  ) {
    return {
      status: "INVALID_TARGET",
      statusReason: "Calculation produced a non-finite rate",
      recommendedKg: null,
      eligibleCount,
      excludedCount,
      exclusionReasons,
      totalServedKg: null,
      totalDiners: null,
      servedPerDiner: null,
      baselineRecommendedKg: null,
    };
  }

  // If target expected diners is invalid, baseline cannot be calculated
  if (!isTargetValid) {
    return {
      status: "INVALID_TARGET",
      statusReason: targetErrorReason,
      recommendedKg: null,
      eligibleCount,
      excludedCount,
      exclusionReasons,
      totalServedKg: totalServedKgNum,
      totalDiners: totalDinersNum,
      servedPerDiner: servedPerDinerNum,
      baselineRecommendedKg: null,
    };
  }

  const expectedDinersDec = new DomainDecimal(target.expectedDiners!);
  const baselineRecommendedDec = servedPerDinerDec.times(expectedDinersDec);
  const baselineRecommendedNum = baselineRecommendedDec.toNumber();

  if (!Number.isFinite(baselineRecommendedNum) || baselineRecommendedNum < 0) {
    return {
      status: "INVALID_TARGET",
      statusReason: "Calculation produced a non-finite recommendation",
      recommendedKg: null,
      eligibleCount,
      excludedCount,
      exclusionReasons,
      totalServedKg: totalServedKgNum,
      totalDiners: totalDinersNum,
      servedPerDiner: servedPerDinerNum,
      baselineRecommendedKg: null,
    };
  }

  return {
    status: "OK",
    recommendedKg: baselineRecommendedNum,
    eligibleCount,
    excludedCount,
    exclusionReasons,
    totalServedKg: totalServedKgNum,
    totalDiners: totalDinersNum,
    servedPerDiner: servedPerDinerNum,
    baselineRecommendedKg: baselineRecommendedNum,
  };
}
