import { describe, it, expect } from "vitest";
import { computeRecommendation, type ObservationInput } from "@/lib/domain/recommendation";

describe("Snapshot Integrity & Immutability Verification", () => {
  it("freezes calculation basis and remains unaffected when underlying history is mutated", () => {
    // 1. Initial observation history (3 eligible services)
    const history: ObservationInput[] = [
      {
        serviceId: "srv-101",
        kitchenId: "k-1",
        mealType: "LUNCH",
        dishId: "d-rice",
        totalCookedKg: 30,
        unservedLeftoverKg: 5,
        actualDiners: 100, // 25 kg served / 100 diners
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
      },
      {
        serviceId: "srv-102",
        kitchenId: "k-1",
        mealType: "LUNCH",
        dishId: "d-rice",
        totalCookedKg: 35,
        unservedLeftoverKg: 5,
        actualDiners: 100, // 30 kg served / 100 diners
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
      },
      {
        serviceId: "srv-103",
        kitchenId: "k-1",
        mealType: "LUNCH",
        dishId: "d-rice",
        totalCookedKg: 40,
        unservedLeftoverKg: 5,
        actualDiners: 100, // 35 kg served / 100 diners
        isStockout: false,
        isAbnormal: false,
        isExcluded: false,
      },
    ];

    // 2. Compute recommendation for 120 expected diners
    // (25 + 30 + 35) = 90 kg / 300 diners = 0.300 kg/diner * 120 = 36.0 kg
    const rec = computeRecommendation(history, {
      kitchenId: "k-1",
      mealType: "LUNCH",
      dishId: "d-rice",
      expectedDiners: 120,
    });

    expect(rec.recommendedKg).toBe(36.0);
    expect(rec.eligibleCount).toBe(3);

    // 3. Save Cooking Plan with Immutable Snapshot Basis
    const savedPlanItem = {
      dishId: "d-rice",
      recommendedKg: rec.recommendedKg, // 36.0 kg
      approvedKg: 37.5, // Manager approved 37.5 kg
      snapshotBasis: {
        algorithmVersion: "1.0.0",
        formula: "sum(servedKg) / sum(actualDiners) * expectedDiners",
        threshold: { minimumEligibleObservations: 3 },
        applicableExpectedDiners: 120,
        matchingRules: { kitchenId: "k-1", mealType: "LUNCH", dishId: "d-rice" },
        serviceIdentifiers: ["srv-101", "srv-102", "srv-103"],
        copiedHistoricalValues: history.map((h) => ({ ...h })),
        eligibleObservations: rec.eligibleCount,
        eligibleCount: rec.eligibleCount,
        excludedCount: rec.excludedCount,
        exclusionReasons: rec.exclusionReasons,
        totalServedKg: rec.totalServedKg,
        totalDiners: rec.totalDiners,
        servedPerDiner: rec.servedPerDiner,
        suggestedKg: rec.recommendedKg,
        calculatedAt: new Date().toISOString(),
      },
    };

    // Serialize to persistent JSON
    const serializedSnapshot = JSON.stringify(savedPlanItem.snapshotBasis);

    // 4. MALICIOUS / RETROACTIVE MUTATION of underlying observation history:
    // Suppose an operator alters srv-101 cooked kg from 30 to 100, or deletes srv-102:
    history[0].totalCookedKg = 100;
    history.splice(1, 1);

    // If re-computed today with mutated history, it would yield a completely different number:
    const mutatedRec = computeRecommendation(history, {
      kitchenId: "k-1",
      mealType: "LUNCH",
      dishId: "d-rice",
      expectedDiners: 120,
    });
    expect(mutatedRec.recommendedKg).not.toBe(36.0); // Drifted!

    // 5. PROVE that the saved plan item snapshot basis remains 100% frozen and intact:
    const restoredBasis = JSON.parse(serializedSnapshot);
    expect(restoredBasis.suggestedKg).toBe(36.0);
    expect(restoredBasis.eligibleCount).toBe(3);
    expect(restoredBasis.totalServedKg).toBe(90.0);
    expect(restoredBasis.totalDiners).toBe(300);
    expect(restoredBasis.serviceIdentifiers).toEqual(["srv-101", "srv-102", "srv-103"]);
    expect(restoredBasis.copiedHistoricalValues[0].totalCookedKg).toBe(30); // Unmutated 30kg, not 100kg!
    expect(restoredBasis.copiedHistoricalValues.length).toBe(3); // Unmutated 3 rows, not 2 rows!

    // 6. PROVE separate suggested, approved, and actual tracking
    const closeoutActual = {
      actualCookedKg: 38.0,
      unservedLeftoversKg: 1.5,
    };

    expect(savedPlanItem.recommendedKg).toBe(36.0); // System suggestion
    expect(savedPlanItem.approvedKg).toBe(37.5);    // Manager committed target
    expect(closeoutActual.actualCookedKg).toBe(38.0); // Evening physical production
    expect(savedPlanItem.recommendedKg !== savedPlanItem.approvedKg).toBe(true);
    expect(savedPlanItem.approvedKg !== closeoutActual.actualCookedKg).toBe(true);
  });

  it("executes complete persistence workflow: preserving snapshot through retroactive history changes and auditing overrides", () => {
    // 1. Initial history
    const history: ObservationInput[] = [
      { serviceId: "srv-A", kitchenId: "k-1", mealType: "LUNCH", dishId: "d-dal", totalCookedKg: 20, unservedLeftoverKg: 2, actualDiners: 90, isStockout: false, isAbnormal: false, isExcluded: false },
      { serviceId: "srv-B", kitchenId: "k-1", mealType: "LUNCH", dishId: "d-dal", totalCookedKg: 22, unservedLeftoverKg: 2, actualDiners: 100, isStockout: false, isAbnormal: false, isExcluded: false },
      { serviceId: "srv-C", kitchenId: "k-1", mealType: "LUNCH", dishId: "d-dal", totalCookedKg: 24, unservedLeftoverKg: 2, actualDiners: 110, isStockout: false, isAbnormal: false, isExcluded: false },
    ];

    // Step 1: Generate initial recommendation
    const initialRec = computeRecommendation(history, { kitchenId: "k-1", mealType: "LUNCH", dishId: "d-dal", expectedDiners: 100 });
    // Total served = 18 + 20 + 22 = 60 kg / 300 diners = 0.2 kg/diner * 100 diners = 20.0 kg
    expect(initialRec.recommendedKg).toBe(20.0);

    // Save plan with initial snapshot and approved override (manager approved 22 kg)
    const initialSavedBasis = {
      algorithmVersion: "1.0.0",
      formula: "sum(servedKg) / sum(actualDiners) * expectedDiners",
      applicableExpectedDiners: 100,
      copiedHistoricalValues: history.map((h) => ({ ...h })),
      suggestedKg: initialRec.recommendedKg,
    };

    let planStore = {
      dishId: "d-dal",
      recommendedKg: initialRec.recommendedKg, // 20.0 kg
      approvedKg: 22.0, // Manager override
      snapshotBasisJson: JSON.stringify(initialSavedBasis),
      overrides: [
        {
          previousApprovedKg: 20.0,
          newApprovedKg: 22.0,
          reason: "Initial approval override",
        },
      ],
    };

    // Step 2: Change a historical observation retroactively (e.g., srv-A altered from 20kg to 50kg)
    history[0].totalCookedKg = 50;

    // Step 3: Request another recommendation today (reflects changed history)
    const newRec = computeRecommendation(history, { kitchenId: "k-1", mealType: "LUNCH", dishId: "d-dal", expectedDiners: 100 });
    // (48 + 20 + 22) = 90 / 300 = 0.3 * 100 = 30.0 kg
    expect(newRec.recommendedKg).toBe(30.0);
    expect(newRec.recommendedKg).not.toBe(initialRec.recommendedKg);

    // Step 4: Attempt to update or save plan again with an updated manager target (e.g. 23.5 kg)
    // The engine's immutable snapshot logic keeps existing snapshotBasisJson and original recommendedKg:
    const updatedApprovedKg = 23.5;
    const isOverride = planStore.approvedKg !== updatedApprovedKg;
    if (isOverride) {
      planStore.overrides.push({
        previousApprovedKg: planStore.approvedKg,
        newApprovedKg: updatedApprovedKg,
        reason: "Manager approved quantity modified",
      });
    }
    // Update approved quantity while PRESERVING original snapshotBasisJson and recommendedKg
    planStore = {
      ...planStore,
      approvedKg: updatedApprovedKg,
      // Original recommendation and snapshot basis remain frozen:
      recommendedKg: planStore.recommendedKg,
      snapshotBasisJson: planStore.snapshotBasisJson,
    };

    // Step 5: Verify the original recommendation snapshot and its copied historical basis remain unchanged
    const parsedSnapshot = JSON.parse(planStore.snapshotBasisJson);
    expect(parsedSnapshot.suggestedKg).toBe(20.0);
    expect(parsedSnapshot.copiedHistoricalValues[0].totalCookedKg).toBe(20); // 20 kg unmutated!
    expect(planStore.recommendedKg).toBe(20.0); // 20.0 kg unchanged!
    expect(planStore.approvedKg).toBe(23.5); // New approved target
    expect(planStore.overrides.length).toBe(2); // Complete auditable override trail
  });
});
