import { describe, it, expect } from "vitest";
import {
  computeRecommendation,
  DomainDecimal,
  type ObservationInput,
  type RecommendationConfig,
} from "@/lib/domain/recommendation";

const defaultTarget = {
  kitchenId: "kitchen-1",
  mealType: "LUNCH",
  dishId: "dish-1",
  expectedDiners: 100,
};

const defaultConfig: RecommendationConfig = {
  minimumEligibleObservations: 3,
};

let serviceCounter = 1;
function createObservation(overrides: Partial<ObservationInput> = {}): ObservationInput {
  return {
    serviceId: `service-${serviceCounter++}`,
    kitchenId: "kitchen-1",
    mealType: "LUNCH",
    dishId: "dish-1",
    totalCookedKg: 30,
    unservedLeftoverKg: 5,
    actualDiners: 100,
    isStockout: false,
    isAbnormal: false,
    isExcluded: false,
    ...overrides,
  };
}

describe("computeRecommendation", () => {
  describe("Decimal Precision & Arithmetic", () => {
    it("preserves exact 0.1 + 0.2 in DomainDecimal and public output", () => {
      // 1. Direct isolated DomainDecimal assertion
      const d1 = new DomainDecimal(0.1);
      const d2 = new DomainDecimal(0.2);
      expect(d1.plus(d2).toString()).toBe("0.3");
      expect(d1.plus(d2).toNumber()).toBe(0.3);

      // 2. Engine-level execution
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", totalCookedKg: 0.1, unservedLeftoverKg: 0, actualDiners: 1 }),
        createObservation({ serviceId: "s-2", totalCookedKg: 0.2, unservedLeftoverKg: 0, actualDiners: 1 }),
        createObservation({ serviceId: "s-3", totalCookedKg: 0.0, unservedLeftoverKg: 0, actualDiners: 1 }),
      ];

      const result = computeRecommendation(
        observations,
        { ...defaultTarget, expectedDiners: 3 },
        defaultConfig
      );

      expect(result.status).toBe("OK");
      expect(result.totalServedKg).toBe(0.3);
      expect(result.totalDiners).toBe(3);
      expect(result.servedPerDiner).toBe(0.1);
      expect(result.recommendedKg).toBe(0.3);
    });

    it("evaluates 100 / 3 * 3 without binary floating-point artifact", () => {
      // Direct DomainDecimal check
      const hundred = new DomainDecimal(100);
      const three = new DomainDecimal(3);
      const rate = hundred.dividedBy(three); // 33.333333333333333333
      const total = rate.times(three);
      expect(total.toNumber()).toBe(100);

      // Engine test with 3 eligible services summing to 100 kg across 3 diners
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", totalCookedKg: 40, unservedLeftoverKg: 0, actualDiners: 1 }),
        createObservation({ serviceId: "s-2", totalCookedKg: 35, unservedLeftoverKg: 0, actualDiners: 1 }),
        createObservation({ serviceId: "s-3", totalCookedKg: 25, unservedLeftoverKg: 0, actualDiners: 1 }),
      ];

      const result = computeRecommendation(
        observations,
        { ...defaultTarget, expectedDiners: 3 },
        defaultConfig
      );

      expect(result.status).toBe("OK");
      expect(result.totalServedKg).toBe(100);
      expect(result.totalDiners).toBe(3);
      expect(result.recommendedKg).toBe(100);
      expect(result.baselineRecommendedKg).toBe(100);
    });

    it("evaluates repeating division with 950 diners yielding exactly 20 kg", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "srv-1", totalCookedKg: 15, unservedLeftoverKg: 5, actualDiners: 50 }), // 10 kg served
        createObservation({ serviceId: "srv-2", totalCookedKg: 95, unservedLeftoverKg: 5, actualDiners: 900 }), // 90 kg served
      ];

      const result = computeRecommendation(
        observations,
        { ...defaultTarget, expectedDiners: 190 },
        { minimumEligibleObservations: 2 }
      );

      expect(result.status).toBe("OK");
      expect(result.eligibleCount).toBe(2);
      expect(result.totalServedKg).toBe(100);
      expect(result.totalDiners).toBe(950);
      // 100 / 950 * 190 = 20.0 kg exact
      expect(result.recommendedKg).toBe(20);
      expect(result.baselineRecommendedKg).toBe(20);
    });
  });

  describe("Core Calculation & Eligibility", () => {
    it("3-service weighted example (100 kg served / 500 diners * 120 expected = 24 kg)", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "srv-A", totalCookedKg: 15, unservedLeftoverKg: 5, actualDiners: 100 }), // 10 kg
        createObservation({ serviceId: "srv-B", totalCookedKg: 70, unservedLeftoverKg: 10, actualDiners: 300 }), // 60 kg
        createObservation({ serviceId: "srv-C", totalCookedKg: 35, unservedLeftoverKg: 5, actualDiners: 100 }), // 30 kg
      ];

      const result = computeRecommendation(
        observations,
        { ...defaultTarget, expectedDiners: 120 },
        defaultConfig
      );

      expect(result.status).toBe("OK");
      expect(result.eligibleCount).toBe(3);
      expect(result.excludedCount).toBe(0);
      expect(result.totalServedKg).toBe(100);
      expect(result.totalDiners).toBe(500);
      expect(result.servedPerDiner).toBe(0.2);
      expect(result.recommendedKg).toBe(24);
      expect(result.baselineRecommendedKg).toBe(24);
    });

    it("stockout exclusion", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", isStockout: true }),
        createObservation({ serviceId: "s-2" }),
        createObservation({ serviceId: "s-3" }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.status).toBe("INSUFFICIENT_HISTORY");
      expect(result.eligibleCount).toBe(2);
      expect(result.excludedCount).toBe(1);
      expect(result.exclusionReasons).toContain("STOCKOUT");
      expect(result.recommendedKg).toBeNull();
    });

    it("abnormal exclusion", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", isAbnormal: true }),
        createObservation({ serviceId: "s-2" }),
        createObservation({ serviceId: "s-3" }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.status).toBe("INSUFFICIENT_HISTORY");
      expect(result.eligibleCount).toBe(2);
      expect(result.excludedCount).toBe(1);
      expect(result.exclusionReasons).toContain("ABNORMAL");
      expect(result.recommendedKg).toBeNull();
    });

    it("missing values treated as missing never zero", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", totalCookedKg: null }),
        createObservation({ serviceId: "s-2", unservedLeftoverKg: null }),
        createObservation({ serviceId: "s-3", actualDiners: null }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.status).toBe("INSUFFICIENT_HISTORY");
      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(3);
      expect(result.exclusionReasons).toEqual([
        "MISSING_COOKED",
        "MISSING_LEFTOVER",
        "MISSING_DINERS",
      ]);
      expect(result.recommendedKg).toBeNull();
    });

    it("negative, non-numeric, NaN, and infinite quantities", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", totalCookedKg: -10 }),
        createObservation({ serviceId: "s-2", unservedLeftoverKg: -5 }),
        createObservation({ serviceId: "s-3", totalCookedKg: NaN }),
        createObservation({ serviceId: "s-4", unservedLeftoverKg: Infinity }),
        createObservation({ serviceId: "s-5", totalCookedKg: "30" as unknown as number }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.status).toBe("INSUFFICIENT_HISTORY");
      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(5);
      expect(result.exclusionReasons.every((r) => r === "INVALID_QUANTITY")).toBe(true);
    });

    it("invalid actual diners (fractional, negative, non-safe integer, non-numeric)", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", actualDiners: 50.5 }),
        createObservation({ serviceId: "s-2", actualDiners: -10 }),
        createObservation({ serviceId: "s-3", actualDiners: Number.MAX_SAFE_INTEGER + 1 }),
        createObservation({ serviceId: "s-4", actualDiners: NaN }),
        createObservation({ serviceId: "s-5", actualDiners: "100" as unknown as number }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.status).toBe("INSUFFICIENT_HISTORY");
      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(5);
      expect(result.exclusionReasons.every((r) => r === "INVALID_DINERS")).toBe(true);
    });

    it("zero actual diners", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", actualDiners: 0 }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(1);
      expect(result.exclusionReasons).toContain("ZERO_DINERS");
      expect(result.recommendedKg).toBeNull();
    });

    it("leftovers exceeding production", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", totalCookedKg: 20, unservedLeftoverKg: 25 }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(1);
      expect(result.exclusionReasons).toContain("LEFTOVER_EXCEEDS_PRODUCTION");
      expect(result.recommendedKg).toBeNull();
    });

    it("valid zero leftovers", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", totalCookedKg: 20, unservedLeftoverKg: 0, actualDiners: 100 }),
        createObservation({ serviceId: "s-2", totalCookedKg: 25, unservedLeftoverKg: 0, actualDiners: 100 }),
        createObservation({ serviceId: "s-3", totalCookedKg: 30, unservedLeftoverKg: 0, actualDiners: 100 }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.status).toBe("OK");
      expect(result.eligibleCount).toBe(3);
      expect(result.totalServedKg).toBe(75);
      expect(result.totalDiners).toBe(300);
      expect(result.servedPerDiner).toBe(0.25);
      expect(result.recommendedKg).toBe(25);
    });

    it("valid zero served quantity, yielding valid zero baseline", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", totalCookedKg: 20, unservedLeftoverKg: 20, actualDiners: 100 }),
        createObservation({ serviceId: "s-2", totalCookedKg: 25, unservedLeftoverKg: 25, actualDiners: 100 }),
        createObservation({ serviceId: "s-3", totalCookedKg: 30, unservedLeftoverKg: 30, actualDiners: 100 }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.status).toBe("OK");
      expect(result.eligibleCount).toBe(3);
      expect(result.totalServedKg).toBe(0);
      expect(result.totalDiners).toBe(300);
      expect(result.servedPerDiner).toBe(0);
      expect(result.recommendedKg).toBe(0);
      expect(result.baselineRecommendedKg).toBe(0);
    });

    it("target expected diners validation (zero, negative, fractional, NaN, infinite, unsafe integer)", () => {
      const validObservations: ObservationInput[] = [
        createObservation({ serviceId: "s-1" }),
        createObservation({ serviceId: "s-2" }),
        createObservation({ serviceId: "s-3" }),
      ];

      const resZero = computeRecommendation(validObservations, { ...defaultTarget, expectedDiners: 0 }, defaultConfig);
      expect(resZero.status).toBe("INVALID_TARGET");
      expect(resZero.recommendedKg).toBeNull();
      expect(resZero.baselineRecommendedKg).toBeNull();
      expect(resZero.statusReason).toContain("greater than zero");
      expect(resZero.eligibleCount).toBe(3);

      const resNeg = computeRecommendation(validObservations, { ...defaultTarget, expectedDiners: -10 }, defaultConfig);
      expect(resNeg.status).toBe("INVALID_TARGET");
      expect(resNeg.recommendedKg).toBeNull();

      const resFrac = computeRecommendation(validObservations, { ...defaultTarget, expectedDiners: 120.5 }, defaultConfig);
      expect(resFrac.status).toBe("INVALID_TARGET");
      expect(resFrac.recommendedKg).toBeNull();

      const resNaN = computeRecommendation(validObservations, { ...defaultTarget, expectedDiners: NaN }, defaultConfig);
      expect(resNaN.status).toBe("INVALID_TARGET");
      expect(resNaN.recommendedKg).toBeNull();

      const resInf = computeRecommendation(validObservations, { ...defaultTarget, expectedDiners: Infinity }, defaultConfig);
      expect(resInf.status).toBe("INVALID_TARGET");
      expect(resInf.recommendedKg).toBeNull();

      const resUnsafe = computeRecommendation(validObservations, { ...defaultTarget, expectedDiners: Number.MAX_SAFE_INTEGER + 1 }, defaultConfig);
      expect(resUnsafe.status).toBe("INVALID_TARGET");
      expect(resUnsafe.recommendedKg).toBeNull();
    });

    it("missing configuration uses default 3", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1" }),
        createObservation({ serviceId: "s-2" }),
        createObservation({ serviceId: "s-3" }),
      ];

      const resultOmitted = computeRecommendation(observations, defaultTarget);
      expect(resultOmitted.status).toBe("OK");
      expect(resultOmitted.recommendedKg).not.toBeNull();

      const resultEmpty = computeRecommendation(observations, defaultTarget, {});
      expect(resultEmpty.status).toBe("OK");
      expect(resultEmpty.recommendedKg).not.toBeNull();
    });

    it("explicit invalid configuration does not silently fall back", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1" }),
        createObservation({ serviceId: "s-2" }),
        createObservation({ serviceId: "s-3" }),
      ];

      const resZero = computeRecommendation(observations, defaultTarget, { minimumEligibleObservations: 0 });
      expect(resZero.status).toBe("INVALID_CONFIG");
      expect(resZero.recommendedKg).toBeNull();

      const resNeg = computeRecommendation(observations, defaultTarget, { minimumEligibleObservations: -1 });
      expect(resNeg.status).toBe("INVALID_CONFIG");
      expect(resNeg.recommendedKg).toBeNull();

      const resFrac = computeRecommendation(observations, defaultTarget, { minimumEligibleObservations: 2.5 });
      expect(resFrac.status).toBe("INVALID_CONFIG");
      expect(resFrac.recommendedKg).toBeNull();

      const resStr = computeRecommendation(observations, defaultTarget, { minimumEligibleObservations: "3" as unknown as number });
      expect(resStr.status).toBe("INVALID_CONFIG");
      expect(resStr.recommendedKg).toBeNull();
    });

    it("thresholds above and at eligible count", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1" }),
        createObservation({ serviceId: "s-2" }),
        createObservation({ serviceId: "s-3" }),
        createObservation({ serviceId: "s-4" }),
      ];

      const resAt = computeRecommendation(observations, defaultTarget, { minimumEligibleObservations: 4 });
      expect(resAt.status).toBe("OK");
      expect(resAt.recommendedKg).not.toBeNull();

      const resAbove = computeRecommendation(observations, defaultTarget, { minimumEligibleObservations: 5 });
      expect(resAbove.status).toBe("INSUFFICIENT_HISTORY");
      expect(resAbove.recommendedKg).toBeNull();
    });

    it("different dish/meal/kitchen not pooled", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", kitchenId: "kitchen-2" }),
        createObservation({ serviceId: "s-2", mealType: "DINNER" }),
        createObservation({ serviceId: "s-3", dishId: "dish-2" }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(3);
      expect(result.exclusionReasons).toEqual([
        "DIFFERENT_KITCHEN",
        "DIFFERENT_MEAL_TYPE",
        "DIFFERENT_DISH",
      ]);
      expect(result.recommendedKg).toBeNull();
    });

    it("missing service identity", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "" }),
        createObservation({ serviceId: "   " }),
        createObservation({ serviceId: null as unknown as string }),
        createObservation({ serviceId: undefined as unknown as string }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(4);
      expect(result.exclusionReasons.every((r) => r === "MISSING_SERVICE_ID")).toBe(true);
      expect(result.recommendedKg).toBeNull();
    });

    it("duplicate matching services excluded without selecting a winner", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "dup-service-1", totalCookedKg: 30, unservedLeftoverKg: 5, actualDiners: 100 }),
        createObservation({ serviceId: "dup-service-1", totalCookedKg: 35, unservedLeftoverKg: 5, actualDiners: 100 }),
        createObservation({ serviceId: "unique-service-2", totalCookedKg: 40, unservedLeftoverKg: 5, actualDiners: 100 }),
        createObservation({ serviceId: "unique-service-3", totalCookedKg: 45, unservedLeftoverKg: 5, actualDiners: 100 }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.exclusionReasons).toContain("DUPLICATE_SERVICE");
      expect(result.exclusionReasons.filter((r) => r === "DUPLICATE_SERVICE").length).toBe(2);
      expect(result.eligibleCount).toBe(2);
      expect(result.status).toBe("INSUFFICIENT_HISTORY");
      expect(result.recommendedKg).toBeNull();
    });

    it("duplicate group containing conflicting flags/values", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "conflict-srv", isStockout: true, totalCookedKg: 30, unservedLeftoverKg: 0, actualDiners: 100 }),
        createObservation({ serviceId: "conflict-srv", isStockout: false, totalCookedKg: 50, unservedLeftoverKg: 10, actualDiners: 120 }),
        createObservation({ serviceId: "valid-1" }),
        createObservation({ serviceId: "valid-2" }),
        createObservation({ serviceId: "valid-3" }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.exclusionReasons.filter((r) => r === "DUPLICATE_SERVICE").length).toBe(2);
      expect(result.eligibleCount).toBe(3);
      expect(result.status).toBe("OK");
      expect(result.recommendedKg).not.toBeNull();
    });

    it("exclusion reason visibility comprehensive check", () => {
      const observations: ObservationInput[] = [
        createObservation({ serviceId: "s-1", kitchenId: "other-kitchen" }),
        createObservation({ serviceId: "s-2", mealType: "BREAKFAST" }),
        createObservation({ serviceId: "s-3", dishId: "other-dish" }),
        createObservation({ serviceId: "s-4", isStockout: true }),
        createObservation({ serviceId: "s-5", isAbnormal: true }),
        createObservation({ serviceId: "s-6", isExcluded: true }),
        createObservation({ serviceId: "s-7", totalCookedKg: null }),
        createObservation({ serviceId: "s-8", unservedLeftoverKg: null }),
        createObservation({ serviceId: "s-9", actualDiners: null }),
        createObservation({ serviceId: "s-10", totalCookedKg: 10, unservedLeftoverKg: 20 }),
        createObservation({ serviceId: "s-11", actualDiners: 0 }),
        createObservation({ serviceId: "s-12", totalCookedKg: -5 }),
        createObservation({ serviceId: "s-13", actualDiners: -20 }),
        createObservation({ serviceId: "" }),
      ];

      const result = computeRecommendation(observations, defaultTarget, defaultConfig);

      expect(result.eligibleCount).toBe(0);
      expect(result.excludedCount).toBe(14);
      expect(result.exclusionReasons).toEqual([
        "DIFFERENT_KITCHEN",
        "DIFFERENT_MEAL_TYPE",
        "DIFFERENT_DISH",
        "STOCKOUT",
        "ABNORMAL",
        "EXCLUDED",
        "MISSING_COOKED",
        "MISSING_LEFTOVER",
        "MISSING_DINERS",
        "LEFTOVER_EXCEEDS_PRODUCTION",
        "ZERO_DINERS",
        "INVALID_QUANTITY",
        "INVALID_DINERS",
        "MISSING_SERVICE_ID",
      ]);
    });
  });
});
