import { describe, it, expect } from "vitest";
import { computeRecommendation, type ObservationInput } from "@/lib/domain/recommendation";

describe("E2E Kitchen Operational Lifecycle Simulation", () => {
  it("simulates the entire morning planning -> baseline -> closeout -> persistence loop", () => {
    // 1. Setup: 3 historical qualifying services for Rice (dish-rice) in Central Kitchen A
    const history: ObservationInput[] = [
      {
        serviceId: "srv-2026-10-20-lunch",
        kitchenId: "kitchen-central-a",
        mealType: "LUNCH",
        dishId: "dish-rice",
        totalCookedKg: 30.0,
        unservedLeftoverKg: 5.0,
        actualDiners: 100, // 25 kg served / 100 diners = 0.250 kg/diner
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
      },
      {
        serviceId: "srv-2026-10-21-lunch",
        kitchenId: "kitchen-central-a",
        mealType: "LUNCH",
        dishId: "dish-rice",
        totalCookedKg: 35.0,
        unservedLeftoverKg: 5.0,
        actualDiners: 150, // 30 kg served / 150 diners = 0.200 kg/diner
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
      },
      {
        serviceId: "srv-2026-10-22-lunch",
        kitchenId: "kitchen-central-a",
        mealType: "LUNCH",
        dishId: "dish-rice",
        totalCookedKg: 40.0,
        unservedLeftoverKg: 5.0,
        actualDiners: 150, // 35 kg served / 150 diners = 0.233 kg/diner
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
      },
      // Plus 1 excluded stockout service
      {
        serviceId: "srv-2026-10-19-lunch",
        kitchenId: "kitchen-central-a",
        mealType: "LUNCH",
        dishId: "dish-rice",
        totalCookedKg: 20.0,
        unservedLeftoverKg: 0.0,
        actualDiners: 120,
        isStockout: true,
        isAbnormal: false,
        isExcluded: false,
      },
    ];

    // 2. Morning Planning: Kitchen manager enters 160 expected diners
    const morningTarget = {
      kitchenId: "kitchen-central-a",
      mealType: "LUNCH",
      dishId: "dish-rice",
      expectedDiners: 160,
    };

    const morningRec = computeRecommendation(history, morningTarget);

    expect(morningRec.status).toBe("OK");
    expect(morningRec.eligibleCount).toBe(3);
    expect(morningRec.excludedCount).toBe(1);
    expect(morningRec.exclusionReasons).toContain("STOCKOUT");
    // Aggregate: (25 + 30 + 35) = 90 kg served / (100 + 150 + 150) = 400 diners = 0.225 kg/diner
    expect(morningRec.totalServedKg).toBe(90.0);
    expect(morningRec.totalDiners).toBe(400);
    expect(morningRec.servedPerDiner).toBe(0.225);
    // Baseline: 160 * 0.225 = 36.0 kg
    expect(morningRec.recommendedKg).toBe(36.0);

    // 3. Plan Approval: Manager approves 36.5 kg with adjustments
    const approvedPlan = {
      planId: "plan-lunch-2026-10-23",
      mealId: "meal-lunch-2026-10-23",
      expectedDiners: 160,
      status: "APPROVED",
      items: [
        {
          dishId: "dish-rice",
          recommendedKg: morningRec.recommendedKg,
          approvedKg: 36.5,
        },
      ],
    };

    expect(approvedPlan.items[0].approvedKg).toBe(36.5);

    // 4. Evening Closeout: Actual service attendance is 158 diners, 36.5 kg cooked, 2.5 kg leftover
    const closeoutRecord: ObservationInput = {
      serviceId: "srv-2026-10-23-lunch",
      kitchenId: "kitchen-central-a",
      mealType: "LUNCH",
      dishId: "dish-rice",
      totalCookedKg: 36.5,
      unservedLeftoverKg: 2.5,
      actualDiners: 158,
      isStockout: false,
      isAbnormal: false,
      isExcluded: false,
    };

    // 5. Subsequent Day Baseline: New closeout is incorporated into the evidence pool
    const updatedHistory = [...history, closeoutRecord];
    const nextDayRec = computeRecommendation(updatedHistory, {
      kitchenId: "kitchen-central-a",
      mealType: "LUNCH",
      dishId: "dish-rice",
      expectedDiners: 100,
    });

    expect(nextDayRec.status).toBe("OK");
    expect(nextDayRec.eligibleCount).toBe(4); // now 4 eligible services
    // Total served: 90 + 34.0 = 124.0 kg; Total diners: 400 + 158 = 558
    expect(nextDayRec.totalServedKg).toBe(124.0);
    expect(nextDayRec.totalDiners).toBe(558);
    expect(nextDayRec.recommendedKg).toBeCloseTo(100 * (124.0 / 558), 6);
  });
});
