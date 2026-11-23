/**
 * Device-local draft persistence for kitchen closeouts.
 * Allows kitchen station operators to preserve in-progress entries during network dropouts.
 * Strictly local-only: Never sends draft data over the wire, never auto-submits,
 * and clears on verified server submission.
 */

export type CloseoutDraftItem = {
  dishId: string;
  dishName?: string;
  approvedKg?: number | null;
  totalCookedKg: string;
  unservedLeftoverKg: string;
  isStockout: boolean;
  isAbnormal: boolean;
  notes?: string;
};

export type CloseoutDraftPayload = {
  kitchenId: string;
  date: string;
  mealType: string;
  mealId?: string | null;
  actualDiners: number;
  planExpectedDiners?: number | null;
  isUnplanned?: boolean;
  selectedMode?: string;
  items: CloseoutDraftItem[];
  savedAt: string; // ISO 8601 timestamp
};

export const CLOSEOUT_DRAFT_PREFIX = "cookcue-closeout-draft";

/**
 * Builds standard storage key:
 * cookcue-closeout-draft:<kitchenId>:<date>:<mealType>
 */
export function getCloseoutDraftKey(params: {
  kitchenId: string;
  date: string;
  mealType: string;
  mealId?: string | null;
}): string {
  const { kitchenId, date, mealType } = params;
  return `${CLOSEOUT_DRAFT_PREFIX}:${kitchenId}:${date}:${mealType.toUpperCase()}`;
}

/**
 * Saves a closeout draft payload to localStorage.
 * Returns true if saved successfully, false on error/quota.
 */
export function saveCloseoutDraft(key: string, payload: CloseoutDraftPayload): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    const serialized = JSON.stringify({
      ...payload,
      savedAt: payload.savedAt || new Date().toISOString(),
    });
    window.localStorage.setItem(key, serialized);
    return true;
  } catch (err) {
    console.warn("Failed to persist closeout draft to localStorage:", err);
    return false;
  }
}

/**
 * Loads a closeout draft from localStorage.
 * Returns null if not found or corrupted.
 */
export function loadCloseoutDraft(key: string): CloseoutDraftPayload | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.items) &&
      typeof parsed.actualDiners === "number"
    ) {
      return parsed as CloseoutDraftPayload;
    }
    return null;
  } catch (err) {
    console.warn("Failed to read closeout draft from localStorage:", err);
    return null;
  }
}

/**
 * Clears a specific closeout draft from localStorage.
 */
export function clearCloseoutDraft(key: string): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn("Failed to clear closeout draft from localStorage:", err);
  }
}

/**
 * Checks if a valid draft exists for the key.
 */
export function hasCloseoutDraft(key: string): boolean {
  return loadCloseoutDraft(key) !== null;
}
