import { describe, it, expect } from "vitest";

describe("Kitchen Results Dashboard Metrics & Hygiene", () => {
  type RecordInput = {
    serviceDate: string;
    mealType: string;
    dishId: string;
    suggestedKg: number | null;
    approvedKg: number | null;
    totalCookedKg: number | null;
    unservedLeftoverKg: number | null;
    actualDiners: number | null;
    isStockout: boolean;
    isAbnormal: boolean;
    isExcluded: boolean;
  };

  function computeDashboard(records: RecordInput[], filter?: { mealType?: string; dishId?: string }) {
    const filtered = records.filter((r) => {
      if (filter?.mealType && filter.mealType !== "ALL" && r.mealType !== filter.mealType) return false;
      if (filter?.dishId && filter.dishId !== "ALL" && r.dishId !== filter.dishId) return false;
      return true;
    });

    let totalSuggestedKg = 0;
    let totalApprovedKg = 0;
    let totalCookedKg = 0;
    let totalLeftoverKg = 0;
    let totalActualDiners = 0;
    let stockoutCount = 0;
    let abnormalCount = 0;
    let excludedCount = 0;
    let missingCount = 0;

    const seenDates = new Set<string>();

    for (const r of filtered) {
      if (r.suggestedKg !== null) totalSuggestedKg += r.suggestedKg;
      if (r.approvedKg !== null) totalApprovedKg += r.approvedKg;
      if (r.totalCookedKg !== null) totalCookedKg += r.totalCookedKg;
      if (r.unservedLeftoverKg !== null) totalLeftoverKg += r.unservedLeftoverKg;

      if (r.isStockout) stockoutCount += 1;
      if (r.isAbnormal) abnormalCount += 1;
      if (r.isExcluded) excludedCount += 1;

      if (r.totalCookedKg === null || r.unservedLeftoverKg === null || r.actualDiners === null) {
        missingCount += 1;
      }

      if (r.actualDiners !== null && !seenDates.has(r.serviceDate + r.mealType)) {
        totalActualDiners += r.actualDiners;
        seenDates.add(r.serviceDate + r.mealType);
      }
    }

    const leftoverPerDiner = totalActualDiners > 0 ? totalLeftoverKg / totalActualDiners : null;

    return {
      totalServices: seenDates.size,
      totalActualDiners,
      totalSuggestedKg,
      totalApprovedKg,
      totalCookedKg,
      totalLeftoverKg,
      leftoverPerDiner,
      stockoutCount,
      abnormalCount,
      excludedCount,
      missingCount,
    };
  }

  const fixtureData: RecordInput[] = [
    {
      serviceDate: "2026-10-20",
      mealType: "LUNCH",
      dishId: "d-rice",
      suggestedKg: 30.0,
      approvedKg: 32.0,
      totalCookedKg: 32.0,
      unservedLeftoverKg: 4.0,
      actualDiners: 100,
      isStockout: false,
      isAbnormal: false,
      isExcluded: false,
    },
    {
      serviceDate: "2026-10-20",
      mealType: "LUNCH",
      dishId: "d-dal",
      suggestedKg: 20.0,
      approvedKg: 22.0,
      totalCookedKg: 22.0,
      unservedLeftoverKg: 2.0,
      actualDiners: 100,
      isStockout: false,
      isAbnormal: false,
      isExcluded: false,
    },
    {
      serviceDate: "2026-10-21",
      mealType: "DINNER",
      dishId: "d-rice",
      suggestedKg: 25.0,
      approvedKg: 25.0,
      totalCookedKg: 20.0,
      unservedLeftoverKg: 0.0,
      actualDiners: 120,
      isStockout: true, // Stockout incident
      isAbnormal: false,
      isExcluded: false,
    },
    {
      serviceDate: "2026-10-22",
      mealType: "LUNCH",
      dishId: "d-rice",
      suggestedKg: null,
      approvedKg: null,
      totalCookedKg: null, // Missing observation
      unservedLeftoverKg: null,
      actualDiners: null,
      isStockout: false,
      isAbnormal: true, // Abnormal flag
      isExcluded: true, // Excluded
    },
  ];

  it("calculates separate metrics for suggested, approved, and actual production", () => {
    const res = computeDashboard(fixtureData);

    // Suggested: 30 + 20 + 25 = 75.0
    expect(res.totalSuggestedKg).toBe(75.0);
    // Approved: 32 + 22 + 25 = 79.0
    expect(res.totalApprovedKg).toBe(79.0);
    // Actual Cooked: 32 + 22 + 20 = 74.0
    expect(res.totalCookedKg).toBe(74.0);
    // Unserved Leftovers: 4 + 2 + 0 = 6.0
    expect(res.totalLeftoverKg).toBe(6.0);
  });

  it("calculates leftovers per diner safely and counts stockouts, abnormal, and missing rows", () => {
    const res = computeDashboard(fixtureData);

    // Total actual diners across unique services: 100 (2026-10-20 LUNCH) + 120 (2026-10-21 DINNER) = 220
    expect(res.totalActualDiners).toBe(220);
    // Leftovers per diner: 6.0 kg / 220 diners = 0.02727... kg/diner
    expect(res.leftoverPerDiner).toBeCloseTo(6.0 / 220, 4);

    expect(res.stockoutCount).toBe(1);
    expect(res.abnormalCount).toBe(1);
    expect(res.excludedCount).toBe(1);
    expect(res.missingCount).toBe(1);
  });

  it("handles empty data and invalid denominators gracefully without NaN or errors", () => {
    const emptyRes = computeDashboard([]);
    expect(emptyRes.totalActualDiners).toBe(0);
    expect(emptyRes.totalLeftoverKg).toBe(0);
    expect(emptyRes.leftoverPerDiner).toBeNull(); // Safe division, no NaN!
    expect(emptyRes.stockoutCount).toBe(0);
  });

  it("applies meal-type and dish filters accurately", () => {
    const lunchRiceOnly = computeDashboard(fixtureData, { mealType: "LUNCH", dishId: "d-rice" });
    // Only 2026-10-20 LUNCH d-rice (30 suggested, 32 approved, 32 cooked, 4 leftover)
    // and 2026-10-22 LUNCH d-rice (nulls)
    expect(lunchRiceOnly.totalSuggestedKg).toBe(30.0);
    expect(lunchRiceOnly.totalApprovedKg).toBe(32.0);
    expect(lunchRiceOnly.totalCookedKg).toBe(32.0);
    expect(lunchRiceOnly.totalLeftoverKg).toBe(4.0);
    expect(lunchRiceOnly.stockoutCount).toBe(0);
  });
});
