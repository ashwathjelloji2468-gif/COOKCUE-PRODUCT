export type CloseoutMode = "CUSTOM" | "AS_PLANNED" | "RAN_OUT";

export type CloseoutModeItemInput = {
  dishId: string;
  dishName: string;
  approvedKg: number | null;
  totalCookedKg: string;
  unservedLeftoverKg: string;
  isStockout: boolean;
  isAbnormal: boolean;
  notes?: string;
};

/**
 * Applies preset closeout modes to form fields client-side.
 * - AS_PLANNED: totalCookedKg from approved plan target; unservedLeftoverKg = 0; isStockout = false
 * - RAN_OUT: unservedLeftoverKg = 0; isStockout = true; cooked from plan if available
 * - CUSTOM: preserves manual entries
 */
export function applyCloseoutMode(
  mode: CloseoutMode,
  items: CloseoutModeItemInput[]
): CloseoutModeItemInput[] {
  if (mode === "CUSTOM") {
    return items;
  }

  if (mode === "AS_PLANNED") {
    return items.map((item) => ({
      ...item,
      totalCookedKg:
        item.approvedKg !== null ? String(item.approvedKg) : item.totalCookedKg,
      unservedLeftoverKg: "0",
      isStockout: false,
    }));
  }

  if (mode === "RAN_OUT") {
    return items.map((item) => ({
      ...item,
      totalCookedKg:
        item.approvedKg !== null
          ? String(item.approvedKg)
          : item.totalCookedKg,
      unservedLeftoverKg: "0",
      isStockout: true,
    }));
  }

  return items;
}

/**
 * Validates whether 1-click whole-meal closeout can be applied.
 * Requires an approved plan loaded with targets.
 */
export function canApplyWholeMealCloseout(
  isUnplanned: boolean,
  mealId: string | null,
  items: { approvedKg: number | null }[]
): { allowed: boolean; reason?: string } {
  if (isUnplanned || !mealId) {
    return {
      allowed: false,
      reason: "Requires an approved morning plan to prefill targets.",
    };
  }

  const hasTargets = items.length > 0 && items.some((i) => i.approvedKg !== null);
  if (!hasTargets) {
    return {
      allowed: false,
      reason: "Approved plan has no target quantities configured.",
    };
  }

  return { allowed: true };
}

/**
 * 1-click "Whole meal as planned"
 * - Fills all dish rows: totalCookedKg = approvedKg, unservedLeftoverKg = 0, isStockout = false
 * - Populates actualDiners from plan expectedDiners if actualDiners is empty/zero
 */
export function applyWholeMealAsPlanned(
  items: CloseoutModeItemInput[],
  currentActualDiners?: number | null,
  planExpectedDiners?: number | null
): { items: CloseoutModeItemInput[]; actualDiners: number } {
  const updatedItems = items.map((item) => ({
    ...item,
    totalCookedKg:
      item.approvedKg !== null ? String(item.approvedKg) : item.totalCookedKg || "0",
    unservedLeftoverKg: "0",
    isStockout: false,
  }));

  const resolvedDiners =
    currentActualDiners && currentActualDiners > 0
      ? currentActualDiners
      : planExpectedDiners && planExpectedDiners > 0
      ? planExpectedDiners
      : 100;

  return {
    items: updatedItems,
    actualDiners: resolvedDiners,
  };
}

/**
 * 1-click "Whole meal ran out"
 * - Fills all dish rows: totalCookedKg from approvedKg if present, unservedLeftoverKg = 0, isStockout = true
 * - Populates actualDiners from plan expectedDiners if actualDiners is empty/zero
 */
export function applyWholeMealRanOut(
  items: CloseoutModeItemInput[],
  currentActualDiners?: number | null,
  planExpectedDiners?: number | null
): { items: CloseoutModeItemInput[]; actualDiners: number } {
  const updatedItems = items.map((item) => ({
    ...item,
    totalCookedKg:
      item.approvedKg !== null ? String(item.approvedKg) : item.totalCookedKg || "0",
    unservedLeftoverKg: "0",
    isStockout: true,
  }));

  const resolvedDiners =
    currentActualDiners && currentActualDiners > 0
      ? currentActualDiners
      : planExpectedDiners && planExpectedDiners > 0
      ? planExpectedDiners
      : 100;

  return {
    items: updatedItems,
    actualDiners: resolvedDiners,
  };
}
