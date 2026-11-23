export type EligibilityStatus =
  | "PENDING"
  | "ELIGIBLE"
  | "INCOMPLETE"
  | "NEEDS_REVIEW"
  | "EXCLUDED";

export function computeEligibilityStatus(item: {
  totalCookedKg: number | null;
  unservedLeftoverKg: number | null;
  actualDiners: number | null;
  isStockout: boolean;
  isAbnormal: boolean;
  isExcluded?: boolean;
}): EligibilityStatus {
  // If flagged as stockout, abnormal, or excluded -> EXCLUDED
  if (item.isStockout || item.isAbnormal || item.isExcluded) {
    return "EXCLUDED";
  }

  // Leftovers cannot exceed production -> EXCLUDED
  if (
    item.totalCookedKg !== null &&
    item.unservedLeftoverKg !== null &&
    item.unservedLeftoverKg > item.totalCookedKg
  ) {
    return "EXCLUDED";
  }

  // If critical fields missing (do not coerce missing to zero) -> INCOMPLETE
  if (
    item.totalCookedKg === null ||
    item.unservedLeftoverKg === null ||
    item.actualDiners === null
  ) {
    return "INCOMPLETE";
  }

  // Missing or invalid required numeric fields (NaN, negative, non-integer diners, diners <= 0) -> EXCLUDED
  if (
    !Number.isFinite(item.totalCookedKg) ||
    !Number.isFinite(item.unservedLeftoverKg) ||
    !Number.isFinite(item.actualDiners) ||
    item.totalCookedKg < 0 ||
    item.unservedLeftoverKg < 0 ||
    item.actualDiners <= 0 ||
    !Number.isSafeInteger(item.actualDiners)
  ) {
    return "EXCLUDED";
  }

  // All validation passes for learning use -> ELIGIBLE
  return "ELIGIBLE";
}
