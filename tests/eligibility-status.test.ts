import { describe, it, expect } from "vitest";
import { computeEligibilityStatus } from "@/lib/domain/eligibility";
import { computeRecommendation, type ObservationInput } from "@/lib/domain/recommendation";

describe("Observation Eligibility Status & Pure Recommendation Integration", () => {
  describe("computeEligibilityStatus mapping rules", () => {
    it("returns ELIGIBLE when all validation passes for learning use", () => {
      const status = computeEligibilityStatus({
        totalCookedKg: 35.5,
        unservedLeftoverKg: 5.5,
        actualDiners: 150,
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
      });
      expect(status).toBe("ELIGIBLE");
    });

    it("returns EXCLUDED when isStockout is true", () => {
      const status = computeEligibilityStatus({
        totalCookedKg: 30.0,
        unservedLeftoverKg: 0.0,
        actualDiners: 120,
        isStockout: true,
        isAbnormal: false,
      });
      expect(status).toBe("EXCLUDED");
    });

    it("returns EXCLUDED when isAbnormal is true", () => {
      const status = computeEligibilityStatus({
        totalCookedKg: 30.0,
        unservedLeftoverKg: 10.0,
        actualDiners: 50,
        isStockout: false,
        isAbnormal: true,
      });
      expect(status).toBe("EXCLUDED");
    });

    it("returns EXCLUDED when isExcluded is true", () => {
      const status = computeEligibilityStatus({
        totalCookedKg: 30.0,
        unservedLeftoverKg: 5.0,
        actualDiners: 100,
        isStockout: false,
        isAbnormal: false,
        isExcluded: true,
      });
      expect(status).toBe("EXCLUDED");
    });

    it("returns EXCLUDED when leftovers exceed production", () => {
      const status = computeEligibilityStatus({
        totalCookedKg: 20.0,
        unservedLeftoverKg: 25.0,
        actualDiners: 100,
        isStockout: false,
        isAbnormal: false,
      });
      expect(status).toBe("EXCLUDED");
    });

    it("returns EXCLUDED when actualDiners is zero or negative", () => {
      expect(
        computeEligibilityStatus({
          totalCookedKg: 20.0,
          unservedLeftoverKg: 5.0,
          actualDiners: 0,
          isStockout: false,
          isAbnormal: false,
        })
      ).toBe("EXCLUDED");

      expect(
        computeEligibilityStatus({
          totalCookedKg: 20.0,
          unservedLeftoverKg: 5.0,
          actualDiners: -10,
          isStockout: false,
          isAbnormal: false,
        })
      ).toBe("EXCLUDED");
    });

    it("returns EXCLUDED when quantities are negative or non-finite", () => {
      expect(
        computeEligibilityStatus({
          totalCookedKg: -5.0,
          unservedLeftoverKg: 0,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
        })
      ).toBe("EXCLUDED");

      expect(
        computeEligibilityStatus({
          totalCookedKg: Number.NaN,
          unservedLeftoverKg: 0,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
        })
      ).toBe("EXCLUDED");
    });

    it("returns INCOMPLETE when critical fields are missing (do not coerce missing to zero)", () => {
      // Cooked is null
      expect(
        computeEligibilityStatus({
          totalCookedKg: null,
          unservedLeftoverKg: 5.0,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
        })
      ).toBe("INCOMPLETE");

      // Leftover is null
      expect(
        computeEligibilityStatus({
          totalCookedKg: 25.0,
          unservedLeftoverKg: null,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
        })
      ).toBe("INCOMPLETE");

      // Diners is null
      expect(
        computeEligibilityStatus({
          totalCookedKg: 25.0,
          unservedLeftoverKg: 5.0,
          actualDiners: null,
          isStockout: false,
          isAbnormal: false,
        })
      ).toBe("INCOMPLETE");
    });

    it("returns EXCLUDED even when fields are null if stockout or abnormal is flagged", () => {
      expect(
        computeEligibilityStatus({
          totalCookedKg: null,
          unservedLeftoverKg: null,
          actualDiners: null,
          isStockout: true,
          isAbnormal: false,
        })
      ).toBe("EXCLUDED");
    });
  });

  describe("computeRecommendation with explicit eligibilityStatus", () => {
    const target = {
      kitchenId: "k-1",
      mealType: "LUNCH",
      dishId: "d-1",
      expectedDiners: 100,
    };

    it("accepts observations with eligibilityStatus === 'ELIGIBLE' and performs pure math", () => {
      const observations: ObservationInput[] = [
        {
          serviceId: "s-1",
          kitchenId: "k-1",
          mealType: "LUNCH",
          dishId: "d-1",
          totalCookedKg: 30,
          unservedLeftoverKg: 5, // served = 25
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "ELIGIBLE",
        },
        {
          serviceId: "s-2",
          kitchenId: "k-1",
          mealType: "LUNCH",
          dishId: "d-1",
          totalCookedKg: 35,
          unservedLeftoverKg: 10, // served = 25
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "ELIGIBLE",
        },
        {
          serviceId: "s-3",
          kitchenId: "k-1",
          mealType: "LUNCH",
          dishId: "d-1",
          totalCookedKg: 40,
          unservedLeftoverKg: 15, // served = 25
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "ELIGIBLE",
        },
      ];

      const res = computeRecommendation(observations, target, { minimumEligibleObservations: 3 });
      expect(res.status).toBe("OK");
      expect(res.eligibleCount).toBe(3);
      expect(res.excludedCount).toBe(0);
      // Total served: 75 kg / 300 diners = 0.25 kg/diner * 100 expected diners = 25 kg
      expect(res.recommendedKg).toBe(25);
    });

    it("excludes observations with eligibilityStatus === 'EXCLUDED'", () => {
      const observations: ObservationInput[] = [
        {
          serviceId: "s-1",
          kitchenId: "k-1",
          mealType: "LUNCH",
          dishId: "d-1",
          totalCookedKg: 30,
          unservedLeftoverKg: 5,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "ELIGIBLE",
        },
        {
          serviceId: "s-2",
          kitchenId: "k-1",
          mealType: "LUNCH",
          dishId: "d-1",
          totalCookedKg: 30,
          unservedLeftoverKg: 5,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "ELIGIBLE",
        },
        {
          serviceId: "s-3",
          kitchenId: "k-1",
          mealType: "LUNCH",
          dishId: "d-1",
          totalCookedKg: 30,
          unservedLeftoverKg: 5,
          actualDiners: 100,
          isStockout: true,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "EXCLUDED",
        },
      ];

      const res = computeRecommendation(observations, target, { minimumEligibleObservations: 3 });
      expect(res.status).toBe("INSUFFICIENT_HISTORY");
      expect(res.eligibleCount).toBe(2);
      expect(res.excludedCount).toBe(1);
      expect(res.recommendedKg).toBeNull();
    });

    it("excludes observations with eligibilityStatus === 'INCOMPLETE'", () => {
      const observations: ObservationInput[] = [
        {
          serviceId: "s-1",
          kitchenId: "k-1",
          mealType: "LUNCH",
          dishId: "d-1",
          totalCookedKg: 30,
          unservedLeftoverKg: 5,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          eligibilityStatus: "INCOMPLETE",
        },
      ];

      const res = computeRecommendation(observations, target);
      expect(res.eligibleCount).toBe(0);
      expect(res.excludedCount).toBe(1);
    });

    it("maintains compatibility when eligibilityStatus is omitted / undefined", () => {
      const observations: ObservationInput[] = [
        {
          serviceId: "s-1",
          kitchenId: "k-1",
          mealType: "LUNCH",
          dishId: "d-1",
          totalCookedKg: 20,
          unservedLeftoverKg: 0,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
        },
        {
          serviceId: "s-2",
          kitchenId: "k-1",
          mealType: "LUNCH",
          dishId: "d-1",
          totalCookedKg: 20,
          unservedLeftoverKg: 0,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
        },
        {
          serviceId: "s-3",
          kitchenId: "k-1",
          mealType: "LUNCH",
          dishId: "d-1",
          totalCookedKg: 20,
          unservedLeftoverKg: 0,
          actualDiners: 100,
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
        },
      ];

      const res = computeRecommendation(observations, target, { minimumEligibleObservations: 3 });
      expect(res.status).toBe("OK");
      expect(res.eligibleCount).toBe(3);
      expect(res.recommendedKg).toBe(20);
    });
  });
});
