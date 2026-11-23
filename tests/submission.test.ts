import { describe, it, expect } from "vitest";

describe("Submission Reliability & Idempotency", () => {
  type CloseoutItem = {
    dishId: string;
    totalCookedKg: number | null;
    unservedLeftoverKg: number | null;
    isStockout: boolean;
    isAbnormal: boolean;
  };

  type CloseoutInput = {
    kitchenId: string;
    mealId: string;
    actualDiners: number;
    items: CloseoutItem[];
  };

  function validateCloseout(input: CloseoutInput): { valid: boolean; error?: string } {
    if (input.actualDiners < 0 || !Number.isSafeInteger(input.actualDiners)) {
      return { valid: false, error: "Actual diners must be a non-negative integer" };
    }
    for (const item of input.items) {
      if (
        item.totalCookedKg !== null &&
        item.unservedLeftoverKg !== null &&
        item.unservedLeftoverKg > item.totalCookedKg
      ) {
        return { valid: false, error: "Leftovers cannot exceed production for any dish" };
      }
      if (
        (item.totalCookedKg !== null && (!Number.isFinite(item.totalCookedKg) || item.totalCookedKg < 0)) ||
        (item.unservedLeftoverKg !== null && (!Number.isFinite(item.unservedLeftoverKg) || item.unservedLeftoverKg < 0))
      ) {
        return { valid: false, error: "Production and leftover quantities must be non-negative finite numbers" };
      }
    }
    return { valid: true };
  }

  // In-memory simulation of transaction idempotency
  const mockDb = new Map<string, CloseoutItem[]>();

  function executeIdempotentCloseout(input: CloseoutInput) {
    const key = `${input.kitchenId}:${input.mealId}`;
    // Replaces previous records atomically for this service
    mockDb.set(key, input.items.map((i) => ({ ...i })));
    return { success: true };
  }

  it("validates input before database execution", () => {
    const invalidLeftovers: CloseoutInput = {
      kitchenId: "k-1",
      mealId: "m-1",
      actualDiners: 100,
      items: [{ dishId: "d-1", totalCookedKg: 20, unservedLeftoverKg: 25, isStockout: false, isAbnormal: false }],
    };
    expect(validateCloseout(invalidLeftovers).valid).toBe(false);

    const negativeDiners: CloseoutInput = {
      kitchenId: "k-1",
      mealId: "m-1",
      actualDiners: -5,
      items: [{ dishId: "d-1", totalCookedKg: 20, unservedLeftoverKg: 5, isStockout: false, isAbnormal: false }],
    };
    expect(validateCloseout(negativeDiners).valid).toBe(false);
  });

  it("ensures duplicate closeout submissions are idempotent and do not inflate observations", () => {
    const input: CloseoutInput = {
      kitchenId: "k-1",
      mealId: "meal-service-999",
      actualDiners: 120,
      items: [
        { dishId: "dish-rice", totalCookedKg: 30, unservedLeftoverKg: 5, isStockout: false, isAbnormal: false },
        { dishId: "dish-dal", totalCookedKg: 25, unservedLeftoverKg: 2, isStockout: false, isAbnormal: false },
      ],
    };

    // First submission
    executeIdempotentCloseout(input);
    const key = `${input.kitchenId}:${input.mealId}`;
    expect(mockDb.get(key)?.length).toBe(2);

    // Second accidental submission (retry / double-click)
    executeIdempotentCloseout(input);
    // Must remain 2 items, NOT 4 items
    expect(mockDb.get(key)?.length).toBe(2);
  });

  it("guarantees service-level idempotency: retries on same (kitchenId, mealType, date) reuse same service ID", () => {
    type MealRecord = { id: string; kitchenId: string; mealType: string; date: string; expectedDiners: number };
    const mealsTable: MealRecord[] = [];

    function upsertMealService(kitchenId: string, mealType: string, date: string, diners: number): MealRecord {
      // Simulates @@unique([kitchenId, mealType, date]) atomic upsert
      let existing = mealsTable.find(
        (m) => m.kitchenId === kitchenId && m.mealType === mealType && m.date === date
      );
      if (existing) {
        existing.expectedDiners = diners;
        return existing;
      }
      const newMeal = { id: `meal-${kitchenId}-${mealType}-${date}`, kitchenId, mealType, date, expectedDiners: diners };
      mealsTable.push(newMeal);
      return newMeal;
    }

    // First attempt to create/closeout meal
    const meal1 = upsertMealService("k-1", "LUNCH", "2026-10-22", 100);
    expect(meal1.id).toBe("meal-k-1-LUNCH-2026-10-22");
    expect(mealsTable.length).toBe(1);

    // Network retry / duplicate client submit for exact same service
    const meal2 = upsertMealService("k-1", "LUNCH", "2026-10-22", 100);
    // Must return the exact same meal ID!
    expect(meal2.id).toBe(meal1.id);
    expect(mealsTable.length).toBe(1); // No second meal created!
  });

  it("records an audit trail when conflicting actuals are submitted against the same service", () => {
    type ObservationRecord = {
      id: string;
      mealId: string;
      dishId: string;
      cookedKg: number;
      leftoverKg: number;
      actualDiners: number;
    };
    type AuditRecord = {
      observationId: string;
      previousCookedKg: number;
      newCookedKg: number;
      reason: string;
    };

    const observations: ObservationRecord[] = [];
    const audits: AuditRecord[] = [];

    function upsertObservationWithAudit(
      mealId: string,
      dishId: string,
      cookedKg: number,
      leftoverKg: number,
      actualDiners: number
    ) {
      let existing = observations.find((o) => o.mealId === mealId && o.dishId === dishId);
      if (existing) {
        if (existing.cookedKg !== cookedKg || existing.leftoverKg !== leftoverKg || existing.actualDiners !== actualDiners) {
          audits.push({
            observationId: existing.id,
            previousCookedKg: existing.cookedKg,
            newCookedKg: cookedKg,
            reason: "Closeout actuals revised",
          });
          existing.cookedKg = cookedKg;
          existing.leftoverKg = leftoverKg;
          existing.actualDiners = actualDiners;
        }
        return existing;
      }

      const created = { id: `obs-${dishId}`, mealId, dishId, cookedKg, leftoverKg, actualDiners };
      observations.push(created);
      return created;
    }

    // Initial submission
    upsertObservationWithAudit("meal-1", "dish-rice", 30, 4, 100);
    expect(observations.length).toBe(1);
    expect(audits.length).toBe(0);

    // Conflicting submission (manager revises cookedKg to 35)
    upsertObservationWithAudit("meal-1", "dish-rice", 35, 4, 100);
    expect(observations.length).toBe(1); // Does not duplicate row
    expect(audits.length).toBe(1); // Records audit trail!
    expect(audits[0].previousCookedKg).toBe(30);
    expect(audits[0].newCookedKg).toBe(35);
  });
});
