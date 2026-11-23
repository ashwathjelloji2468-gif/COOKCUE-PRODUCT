/**
 * Centralized human-friendly operational label map for kitchen station surfaces.
 * Translates technical database and domain terms into plain kitchen operational language.
 * Does not alter database schemas, API contracts, or mathematical logic.
 * Structured for easy future internationalization (i18n).
 */

export const KITCHEN_LABELS = {
  // Quantities & Measures
  totalCookedKg: "Cooked (kg)",
  unservedLeftoverKg: "Left in vessel (kg)",
  actualDiners: "People served",
  expectedDiners: "People expected",
  approvedKg: "Target (kg)",
  recommendedKg: "Suggested (kg)",

  // Incident & Service Statuses
  isStockout: "Food ran out",
  isAbnormal: "Unusual service",
  stockoutIncident: "Food ran out",
  abnormalIncident: "Unusual service disruption",

  // Plan Statuses
  APPROVED: "Approved",
  DRAFT: "Draft — needs approval",
  NO_PLAN: "No plan",

  // Closeout Quick Fill Modes & Actions
  prefillFromLastService: "Prefill from last service",
  wholeMealAsPlanned: "Whole meal as planned",
  wholeMealRanOut: "Whole meal: food ran out",

  // Navigation & Logs
  serviceDiary: "Service log",
  serviceDiaryShort: "Log",
  staffBoard: "Staff Board",
  morningPlan: "Morning Plan",
  closeout: "Closeout",
  handoff: "Handoff",

  // Floor-Facing Eligibility
  eligibleFloorFacing: "Counts for next plan",
  ineligibleFloorFacing: "Excluded from next plan",
} as const;

/**
 * Returns plain-language label for plan approval statuses.
 */
export function formatPlanStatus(status?: string | null): string {
  if (status === "APPROVED") return KITCHEN_LABELS.APPROVED;
  if (status === "DRAFT") return KITCHEN_LABELS.DRAFT;
  if (!status || status === "NO_PLAN") return KITCHEN_LABELS.NO_PLAN;
  return status;
}

/**
 * Returns plain-language label for stockouts.
 */
export function formatStockoutLabel(isStockout: boolean): string {
  return isStockout ? KITCHEN_LABELS.isStockout : "In stock";
}

/**
 * Returns plain-language label for abnormal events.
 */
export function formatAbnormalLabel(isAbnormal: boolean): string {
  return isAbnormal ? KITCHEN_LABELS.isAbnormal : "Normal service";
}
