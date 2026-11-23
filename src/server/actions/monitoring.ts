"use server";

import { prisma } from "@/lib/prisma";
import { requireFounder } from "@/lib/auth/session";
import {
  formatRelativeTime,
  formatExactDateTime,
  isCloseoutStale,
  isBaselineReady,
} from "@/lib/kitchen/reliability";

export type MonitoringSummary = {
  totalKitchens: number;
  totalActiveKitchens: number;
  totalObservations: number;
  totalStockouts: number;
  totalAbnormal: number;
  totalEligible: number;
  kitchens: {
    kitchenId: string;
    kitchenName: string;
    status: string;
    observationCount: number;
    stockoutCount: number;
    abnormalCount: number;
    eligibleCount: number;
    lastCloseoutAt: string | null;
    lastCloseoutRelative: string;
    lastCloseoutExact: string | null;
    lastPlanApprovedAt: string | null;
    lastPlanApprovedRelative: string;
    lastPlanApprovedExact: string | null;
    isBaselineReady: boolean;
    isStale: boolean;
  }[];
};

export async function getPlatformMonitoringSummary(): Promise<
  { success: true; data: MonitoringSummary } | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const eligibleFilter = {
      OR: [
        { eligibilityStatus: "ELIGIBLE" },
        {
          eligibilityStatus: "",
          isStockout: false,
          isAbnormal: false,
          isExcluded: false,
          totalCookedKg: { not: null },
          unservedLeftoverKg: { not: null },
          actualDiners: { not: null, gt: 0 },
        },
      ],
    };

    const [
      totalKitchens,
      totalActiveKitchens,
      totalObservations,
      totalStockouts,
      totalAbnormal,
      totalEligible,
      kitchens,
      obsGrouped,
      stockoutGrouped,
      abnormalGrouped,
      eligibleGrouped,
      approvedPlans,
    ] = await Promise.all([
      prisma.kitchen.count(),
      prisma.kitchen.count({ where: { status: "ACTIVE" } }),
      prisma.observation.count(),
      prisma.observation.count({ where: { isStockout: true } }),
      prisma.observation.count({ where: { isAbnormal: true } }),
      prisma.observation.count({ where: eligibleFilter }),
      prisma.kitchen.findMany({
        select: { id: true, name: true, status: true },
        orderBy: { name: "asc" },
      }),
      prisma.observation.groupBy({
        by: ["kitchenId"],
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.observation.groupBy({
        by: ["kitchenId"],
        where: { isStockout: true },
        _count: { _all: true },
      }),
      prisma.observation.groupBy({
        by: ["kitchenId"],
        where: { isAbnormal: true },
        _count: { _all: true },
      }),
      prisma.observation.groupBy({
        by: ["kitchenId"],
        where: eligibleFilter,
        _count: { _all: true },
      }),
      prisma.cookingPlan.findMany({
        where: {
          OR: [{ status: "APPROVED" }, { approvalStatus: "APPROVED" }],
        },
        select: {
          kitchenId: true,
          firstApprovedAt: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
      }),
    ]);

    const obsMap = new Map(obsGrouped.map((g) => [g.kitchenId, g]));
    const stockoutMap = new Map(stockoutGrouped.map((g) => [g.kitchenId, g._count._all]));
    const abnormalMap = new Map(abnormalGrouped.map((g) => [g.kitchenId, g._count._all]));
    const eligibleMap = new Map(eligibleGrouped.map((g) => [g.kitchenId, g._count._all]));

    const latestApprovedPlanMap = new Map<string, Date>();
    for (const p of approvedPlans) {
      if (!latestApprovedPlanMap.has(p.kitchenId)) {
        const approvalDate = p.firstApprovedAt || p.updatedAt;
        latestApprovedPlanMap.set(p.kitchenId, approvalDate);
      }
    }

    const kitchenStats = kitchens.map((k) => {
      const obs = obsMap.get(k.id);
      const lastCloseoutDate = obs?._max.createdAt ?? null;
      const lastPlanDate = latestApprovedPlanMap.get(k.id) ?? null;
      const eligibleCount = eligibleMap.get(k.id) ?? 0;

      return {
        kitchenId: k.id,
        kitchenName: k.name,
        status: k.status || "ACTIVE",
        observationCount: obs?._count._all ?? 0,
        stockoutCount: stockoutMap.get(k.id) ?? 0,
        abnormalCount: abnormalMap.get(k.id) ?? 0,
        eligibleCount,
        lastCloseoutAt: lastCloseoutDate ? lastCloseoutDate.toISOString() : null,
        lastCloseoutRelative: formatRelativeTime(lastCloseoutDate, "No closeout yet"),
        lastCloseoutExact: formatExactDateTime(lastCloseoutDate),
        lastPlanApprovedAt: lastPlanDate ? lastPlanDate.toISOString() : null,
        lastPlanApprovedRelative: formatRelativeTime(lastPlanDate, "No approved plan yet"),
        lastPlanApprovedExact: formatExactDateTime(lastPlanDate),
        isBaselineReady: isBaselineReady(eligibleCount),
        isStale: isCloseoutStale(lastCloseoutDate, lastPlanDate),
      };
    });

    return {
      success: true,
      data: {
        totalKitchens,
        totalActiveKitchens,
        totalObservations,
        totalStockouts,
        totalAbnormal,
        totalEligible,
        kitchens: kitchenStats,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to load platform monitoring summary" };
  }
}

export async function getKitchenMonitoringDetail(
  kitchenId: string
): Promise<
  | {
      success: true;
      data: {
        kitchen: { id: string; name: string };
        totalObservations: number;
        eligibleCount: number;
        stockoutCount: number;
        abnormalCount: number;
        observations: {
          id: string;
          mealType: string;
          date: string;
          dishName: string;
          totalCookedKg: number | null;
          unservedLeftoverKg: number | null;
          actualDiners: number | null;
          isStockout: boolean;
          isAbnormal: boolean;
          isEligible: boolean;
          eligibilityStatus: string;
        }[];
      };
    }
  | { success: false; error: string }
> {
  const auth = await requireFounder();
  if (!auth.success) return { success: false, error: auth.error };

  try {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
      include: {
        observations: {
          include: {
            dish: true,
            meal: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!kitchen) {
      return { success: false, error: "Kitchen not found" };
    }

    let eligibleCount = 0;
    let stockoutCount = 0;
    let abnormalCount = 0;

    const formattedObservations = kitchen.observations.map((o) => {
      const isEligible = o.eligibilityStatus
        ? o.eligibilityStatus === "ELIGIBLE"
        : !o.isStockout &&
          !o.isAbnormal &&
          !o.isExcluded &&
          o.totalCookedKg !== null &&
          o.unservedLeftoverKg !== null &&
          o.actualDiners !== null &&
          o.actualDiners > 0 &&
          o.unservedLeftoverKg <= o.totalCookedKg;

      if (o.isStockout) stockoutCount += 1;
      if (o.isAbnormal) abnormalCount += 1;
      if (isEligible) eligibleCount += 1;

      const eligibilityStatus =
        o.eligibilityStatus ||
        (isEligible
          ? "ELIGIBLE"
          : o.isStockout || o.isAbnormal || o.isExcluded
          ? "EXCLUDED"
          : "INCOMPLETE");

      return {
        id: o.id,
        mealType: o.meal.mealType,
        date: o.meal.date.toISOString().slice(0, 10),
        dishName: o.dish.name,
        totalCookedKg: o.totalCookedKg,
        unservedLeftoverKg: o.unservedLeftoverKg,
        actualDiners: o.actualDiners,
        isStockout: o.isStockout,
        isAbnormal: o.isAbnormal,
        isEligible,
        eligibilityStatus,
      };
    });

    return {
      success: true,
      data: {
        kitchen: { id: kitchen.id, name: kitchen.name },
        totalObservations: kitchen.observations.length,
        eligibleCount,
        stockoutCount,
        abnormalCount,
        observations: formattedObservations,
      },
    };
  } catch (e) {
    return { success: false, error: "Failed to load kitchen monitoring detail" };
  }
}
